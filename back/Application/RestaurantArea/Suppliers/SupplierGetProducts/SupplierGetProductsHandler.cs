using back.Data;
using back.Infrastructure.Security.Hasher;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea;

public class SupplierGetProductsHandler(AppDbContext dbContext, IPasswordHasher passHasher) : IRequestHandler<SupplierGetProductsCommand, List<ProductItemDto>>
{
    private readonly AppDbContext _dbContext = dbContext;

    public async Task<List<ProductItemDto>> Handle(
        SupplierGetProductsCommand cmd, CancellationToken cnt
    )
    {
        var restaurant = await _dbContext.Restaurants
            .FirstOrDefaultAsync(r => r.Id == cmd.RestaurantId, cnt);

        if (restaurant == null)
        {
            throw new Exception($"Ресторан с ID {cmd.RestaurantId} не найден.");
        }

        var incomingKey = cmd.ApiKey?.Trim();
        var dbKey = restaurant.ApiSecret?.Trim();

        if (string.IsNullOrEmpty(incomingKey) || incomingKey != dbKey)
        {
            throw new Exception($"Неверный API ключ. В базе лежит: '{dbKey}', а пришло: '{incomingKey}'");
        }
        

        var products = await _dbContext.Products
            .Where(p => p.RestaurantId == restaurant.Id)
            .Select(p => new ProductItemDto(
                p.Id,
                p.Name,
                p.ShelfLifeSeconds,
                p.Units
            ))
            .ToListAsync(cnt);

        return products;
    }
}
