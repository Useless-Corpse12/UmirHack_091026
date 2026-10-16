using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.SetProducts;

public class SetProductsHandler(AppDbContext db,IFoodStock foodStock) : IRequestHandler<SetProductsCommand, Unit>
{
    public async Task<Unit> Handle(SetProductsCommand cmd, CancellationToken ct)
    {
        await db.Products.Where(p => p.RestaurantId == cmd.RestaurantId).ExecuteDeleteAsync(ct);

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

       
        await foodStock.SetDishAsync(cmd.RestaurantId, new List<(Guid, string, List<DishItem>)>());

        return Unit.Value;
    }
}