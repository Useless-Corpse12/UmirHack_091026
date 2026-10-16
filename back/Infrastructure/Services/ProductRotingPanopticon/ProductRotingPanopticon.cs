using Quartz;
using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.DaikonBaseContext;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace back.Infrastructure.Services.Workers;

public interface IRotScheduler
{
    Task ScheduleAsync(Guid restId, List<(Guid ProductId, Guid SupplyId, Guid SupplyItemId, DateTime ExpiresAt)> items);
    
    Task ScheduleAllFromStockAsync();
    
    Task CancelAsync(Guid supplyId, Guid productId);
}

public class RotScheduler : IRotScheduler
{
    private readonly ISchedulerFactory _schedulerFactory;
    private readonly IServiceProvider _serviceProvider;

    public RotScheduler(ISchedulerFactory schedulerFactory, IServiceProvider serviceProvider)
    {
        _schedulerFactory = schedulerFactory;
        _serviceProvider = serviceProvider;
    }

    public async Task ScheduleAsync(Guid restId, List<(Guid ProductId, Guid SupplyId, Guid SupplyItemId, DateTime ExpiresAt)> items)
    {
        var scheduler = await _schedulerFactory.GetScheduler();

        foreach (var (productId, supplyId, supplyItemId, expiresAt) in items)
        {
            var jobKey = new JobKey($"rot_{supplyItemId}");

            if (await scheduler.Exists(jobKey))
                await scheduler.DeleteJob(jobKey);

            var job = JobBuilder.Create<RotCheckJob>()
                .WithIdentity(jobKey)
                .UsingJobData("RestaurantId", restId.ToString())
                .UsingJobData("SupplyId", supplyId.ToString())
                .UsingJobData("SupplyItemId", supplyItemId.ToString())
                .UsingJobData("ProductId", productId.ToString())
                .Build();

            var trigger = TriggerBuilder.Create()
                .WithIdentity($"rot_t_{supplyItemId}")
                .StartAt(expiresAt)
                .Build();

            await scheduler.ScheduleJob(job, trigger);
        }
    }

    public async Task ScheduleAllFromStockAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var foodStock = scope.ServiceProvider.GetRequiredService<IFoodStock>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var restaurants = await dbContext.Restaurants.ToListAsync();
        var allItems = new List<(Guid RestId, Guid ProductId, Guid SupplyId, Guid SupplyItemId, DateTime ExpiresAt)>();

        foreach (var rest in restaurants)
        {
            var stock = await foodStock.GetProductsAsync(rest.Id);
            
            foreach (var p in stock)
            {
                var batch = await dbContext.SupplyItems
                    .FirstOrDefaultAsync(si => 
                        si.SupplyId == p.SupplyId && 
                        si.ProductId == p.ProductId &&
                        si.Supply.RestaurantId == rest.Id);

                if (batch != null && batch.FactQuantity > 0)
                {
                    allItems.Add((rest.Id, p.ProductId, p.SupplyId, batch.Id, p.ExpiresAt));
                }
            }
        }

        foreach (var group in allItems.GroupBy(i => i.RestId))
        {
            await ScheduleAsync(
                group.Key, 
                group.Select(i => (i.ProductId, i.SupplyId, i.SupplyItemId, i.ExpiresAt)).ToList()
            );
        }
    }

    public async Task CancelAsync(Guid supplyId, Guid productId)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        var batch = await dbContext.SupplyItems
            .FirstOrDefaultAsync(si => si.SupplyId == supplyId && si.ProductId == productId);

        if (batch == null) return;

        var jobKey = new JobKey($"rot_{batch.Id}");
        if (await scheduler.Exists(jobKey))
            await scheduler.DeleteJob(jobKey);
    }
}

public class RotCheckJob : IJob
{
    private readonly IServiceProvider _serviceProvider;

    public RotCheckJob(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async ValueTask Execute(IJobExecutionContext context,CancellationToken cancellationToken)
    {
        var restId = Guid.Parse(context.JobDetail.JobDataMap.GetString("RestaurantId"));
        var supplyId = Guid.Parse(context.JobDetail.JobDataMap.GetString("SupplyId"));
        var supplyItemId = Guid.Parse(context.JobDetail.JobDataMap.GetString("SupplyItemId"));
        var productId = Guid.Parse(context.JobDetail.JobDataMap.GetString("ProductId"));

        using var scope = _serviceProvider.CreateScope();
        var foodStock = scope.ServiceProvider.GetRequiredService<IFoodStock>();
        var analStash = scope.ServiceProvider.GetRequiredService<IAnalStash>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var stock = await foodStock.GetProductsAsync(restId);
        var productInStock = stock.FirstOrDefault(p => 
            p.SupplyId == supplyId && 
            p.ProductId == productId && 
            p.Quantity > 0);

        if (productInStock == null) return;

        var exists = await dbContext.RotRecords
            .AnyAsync(r => r.SupplyItemId == supplyItemId && !r.Status);

        if (exists) return;

        dbContext.RotRecords.Add(new RotRecord
        {
            Id = Guid.NewGuid(),
            RestaurantId = restId,
            SupplyItemId = supplyItemId,
            ProductId = productId,
            Quantity = productInStock.Quantity,
            Status = false,
            CreatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();
        
        await foodStock.DestroyRottingProductAsync(
            restId,
            new List<(Guid ProductId, Guid SupplyId, int Quantity)>
            {
                (productId, supplyId, productInStock.Quantity)
            }
        );
        
        await analStash.AddRotAsync(restId, new 
        { 
            SupplyItemId = supplyItemId, 
            ProductId = productId, 
            Quantity = productInStock.Quantity 
        }, DateTime.UtcNow);
    }
}