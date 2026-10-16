using back.Data;
using back.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.SetProducts;

public class SetProductsHandler(AppDbContext db) : IRequestHandler<SetProductsCommand, Unit>
{
    public async Task<Unit> Handle(SetProductsCommand cmd, CancellationToken ct)
    {
        
        await db.Products
            .Where(p => p.RestaurantId == cmd.RestaurantId)
            .ExecuteDeleteAsync(ct);

        
        var newProducts = cmd.Products.Select(p => new Product
        {
            Id = Guid.NewGuid(),
            RestaurantId = cmd.RestaurantId,
            Name = p.Name.Trim(),
            ShelfLifeSeconds = p.ShelfLifeSeconds,
            Units = p.Unit.Trim()
        }).ToList();

        await db.Products.AddRangeAsync(newProducts, ct);
        await db.SaveChangesAsync(ct);

        return Unit.Value;
    }
}