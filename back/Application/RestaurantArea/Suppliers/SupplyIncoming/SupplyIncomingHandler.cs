using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Security.Hasher;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.Supplies;

public class SupplyIncomingHandler(
    AppDbContext dbContext
) : IRequestHandler<SupplyIncomingCommand, Guid>
{
    public async Task<Guid> Handle(SupplyIncomingCommand cmd, CancellationToken cancellationToken)
    {
        var restaurant = await dbContext.Restaurants
            .FirstOrDefaultAsync(r => r.Id == cmd.RestaurantId, cancellationToken);
        
        if (restaurant == null || cmd.ApiKey!=restaurant.ApiSecret)
        {
            throw new UnauthorizedAccessException("Неверный Id ресторана или API ключ");
        }

        var supply = new Supply
        {
            Id = Guid.NewGuid(),
            SupplyNumber = cmd.SupplyNumber,
            CreatedAt = DateTime.UtcNow,
            SupplyStatus = (int)SupplyStatus.Created,
            RestaurantId = cmd.RestaurantId,
            Batches = new List<SupplyItem>()
        };

        foreach (var item in cmd.Items)
        {
            var product = await dbContext.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.RestaurantId == cmd.RestaurantId, cancellationToken);

            if (product == null)
            {
                throw new Exception($"Продукт с ID {item.ProductId} не найден или не принадлежит ресторану {cmd.RestaurantId}");
            }

            var supplyItem = new SupplyItem
            {
                Id = Guid.NewGuid(),
                SupplyId = supply.Id,
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                FactQuantity = 0,
                ExpiresAt = DateTime.UtcNow.AddSeconds(product.ShelfLifeSeconds) 
            };

            supply.Batches.Add(supplyItem);
        }

        dbContext.Supplies.Add(supply);
        await dbContext.SaveChangesAsync(cancellationToken);

        return supply.Id;
    }
}