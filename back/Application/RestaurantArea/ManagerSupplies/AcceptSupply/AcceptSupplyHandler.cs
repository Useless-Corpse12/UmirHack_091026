using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.DaikonBaseContext;
using back.Infrastructure.Services.Workers;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.Supplies.AcceptSupply;

public class AcceptSupplyHandler(
    AppDbContext dbContext, 
    IFoodStock foodStock,
    IRotScheduler rotScheduler,
    IAnalStash analStash
) : IRequestHandler<AcceptSupplyCommand, Unit>
{
    public async Task<Unit> Handle(AcceptSupplyCommand cmd, CancellationToken cnt)
    {
        var supply = await dbContext.Supplies
            .Include(s => s.Batches)
            .ThenInclude(b => b.Product)
            .FirstOrDefaultAsync(s => s.Id == cmd.SupplyId, cnt);

        if (supply == null)
            throw new Exception("Поставка не найдена");

        if (supply.SupplyStatus != (int)SupplyStatus.Created)
            throw new Exception("Поставка уже обработана");

        var userRole = await dbContext.UserRestaurants
            .Where(ur => ur.UserId == cmd.UserId && ur.RestaurantId == supply.RestaurantId)
            .Select(ur => ur.Role)
            .FirstOrDefaultAsync(cnt);

        if (userRole != UserRole.Owner && userRole != UserRole.Admin)
            throw new Exception("Недостаточно прав для принятия поставки");

        bool allMatch = true;
        bool hasAnyAccepted = false;

        foreach (var item in cmd.Items)
        {
            var batch = supply.Batches.FirstOrDefault(b => b.ProductId == item.ProductId);
            if (batch == null)
                throw new Exception($"Продукт {item.ProductId} не найден в поставке");

            batch.FactQuantity = item.FactQuantity;

            if (item.FactQuantity > 0)
                hasAnyAccepted = true;

            if (item.FactQuantity != batch.Quantity)
                allMatch = false;
        }

        if (!hasAnyAccepted)
        {
            supply.SupplyStatus = (int)SupplyStatus.Denial;
        }
        else if (allMatch)
        {
            supply.SupplyStatus = (int)SupplyStatus.GotIt; 
        }
        else
        {
            supply.SupplyStatus = (int)SupplyStatus.Partial; 
        }

        await dbContext.SaveChangesAsync(cnt);

        if (hasAnyAccepted)
        {
            var productsForRedis = supply.Batches
                .Where(b => b.FactQuantity > 0)
                .Select(b => (
                    b.ProductId,
                    b.Product?.Name ?? "Unknown",
                    b.FactQuantity,
                    b.ExpiresAt
                ))
                .ToList();

            if (productsForRedis.Any())
            {
                await foodStock.AddProductsBySupplyAsync(
                    supply.RestaurantId,
                    supply.Id,
                    productsForRedis
                );

                var itemsForScheduler = supply.Batches
                    .Where(b => b.FactQuantity > 0)
                    .Select(b => (b.ProductId, supply.Id, b.Id, b.ExpiresAt))
                    .ToList();

                await rotScheduler.ScheduleAsync(supply.RestaurantId, itemsForScheduler);
                
                await analStash.AddSupplyAsync(supply.RestaurantId, new 
                { 
                    supply.Id, 
                    supply.SupplyNumber, 
                    AcceptedBatches = productsForRedis.Count 
                }, supply.CreatedAt);
            }
        }

        return Unit.Value;
    }
}