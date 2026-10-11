using back.Data;
using back.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea;

public class SupplyIncomingHandler(
    AppDbContext dbContext
) : IRequestHandler<SupplyIncomingCommand, Guid>
{
    private readonly AppDbContext _dbContext = dbContext;

    public async Task<Guid> Handle(SupplyIncomingCommand cmd, CancellationToken cancellationToken)
    {
        var restaurantExists = await _dbContext.Restaurants
            .AnyAsync(r => r.Id == cmd.RestaurantId, cancellationToken);

        if (!restaurantExists)
        {
            throw new Exception($"Ресторан с ID {cmd.RestaurantId} не найден");
        }

        var supply = new Supply
        {
            Id = Guid.NewGuid(),
            SupplyNumber = cmd.SupplyNumber,
            CreatedAt = DateTime.UtcNow,
            SupplyStatus = false, // false - создана, но ещё не принята
            RestaurantId = cmd.RestaurantId,
            Batches = new List<SupplyItem>()
        };

        foreach (var item in cmd.Items)
        {
            var productExists = await _dbContext.Products
                .AnyAsync(p => p.Id == item.ProductId && p.RestaurantId == cmd.RestaurantId, cancellationToken);

            if (!productExists)
            {
                throw new Exception($"Продукт с ID {item.ProductId} не найден для ресторана {cmd.RestaurantId}");
            }

            var supplyItem = new SupplyItem
            {
                Id = Guid.NewGuid(),
                ProductId = item.ProductId,
                Quantity = item.Quantity
            };

            supply.Batches.Add(supplyItem);
        }

        _dbContext.Supplies.Add(supply);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return supply.Id;
    }
}