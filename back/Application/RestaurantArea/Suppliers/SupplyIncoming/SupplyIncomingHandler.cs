using back.Data;
using back.Domain.Entities;
using back.Presentation.Hubs;
using MediatR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.Supplies;

public class SupplyIncomingHandler(
    AppDbContext dbContext,
    IHubContext<NotificationHub> hub
) : IRequestHandler<SupplyIncomingCommand, Guid>
{
    public async Task<Guid> Handle(SupplyIncomingCommand cmd, CancellationToken cancellationToken)
    {
        var restaurant = await dbContext.Restaurants
            .FirstOrDefaultAsync(r => r.Id == cmd.RestaurantId, cancellationToken);
        if (restaurant == null || cmd.ApiKey != restaurant.ApiSecret)
            throw new UnauthorizedAccessException("Неверный Id ресторана или API ключ");

        var supply = new Supply
        {
            Id = Guid.NewGuid(),
            SupplyNumber = cmd.SupplyNumber,
            CreatedAt = DateTime.UtcNow,
            SupplyStatus = (int)SupplyStatus.Created,
            RestaurantId = cmd.RestaurantId,
            Batches = new List<SupplyItem>()
        };

        var productNames = new Dictionary<Guid, string>();
        foreach (var item in cmd.Items)
        {
            var product = await dbContext.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.RestaurantId == cmd.RestaurantId, cancellationToken);
            if (product == null)
                throw new Exception($"Продукт {item.ProductId} не найден");

            productNames[product.Id] = product.Name;
            supply.Batches.Add(new SupplyItem
            {
                Id = Guid.NewGuid(),
                SupplyId = supply.Id,
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                FactQuantity = 0,
                ExpiresAt = DateTime.UtcNow.AddSeconds(product.ShelfLifeSeconds)
            });
        }

        dbContext.Supplies.Add(supply);
        await dbContext.SaveChangesAsync(cancellationToken);

        await hub.Clients.Group($"restaurant_{cmd.RestaurantId}")
            .SendAsync("manager.supplies", new[]
            {
                new
                {
                    supplyId = supply.Id,
                    supplyNumber = supply.SupplyNumber,
                    createdAt = supply.CreatedAt,
                    status = "pending",
                    items = supply.Batches.Select(b => new
                    {
                        productId = b.ProductId,
                        productName = productNames[b.ProductId],
                        quantity = b.Quantity,
                        expiresAt = b.ExpiresAt
                    }).ToList()
                }
            }, cancellationToken);

        return supply.Id;
    }
}
