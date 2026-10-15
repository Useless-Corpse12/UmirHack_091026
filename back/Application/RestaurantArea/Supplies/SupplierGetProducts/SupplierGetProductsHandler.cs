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

        if (restaurant == null || !passHasher.Validate(cmd.ApiKey, restaurant.ApiSecret))
        {
            throw new Exception("Неверный Id или пароль");
        }

        var products = await _dbContext.Products
            .Where(p => p.RestaurantId == restaurant.Id)
            .Select(p => new ProductItemDto(
                p.Id,
                p.Name,
                p.ShelfLifeDays,
                p.Units
            ))
            .ToListAsync(cnt);

        return products;
    }
}
