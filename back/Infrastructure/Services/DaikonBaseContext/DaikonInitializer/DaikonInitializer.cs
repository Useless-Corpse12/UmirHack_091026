using back.Data;
using back.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace back.Infrastructure.Services.DaikonBaseContext;

public class DaikonInitializer : IDaikonInitializer
{
    private readonly AppDbContext _db;
    private readonly FoodStock _foodStock;
    private readonly IAnalStash _analStash;

    public DaikonInitializer(AppDbContext db, FoodStock foodStock, IAnalStash analStash)
    {
        _db = db;
        _foodStock = foodStock;
        _analStash = analStash;
    }

    public async Task StockInitializeAsync()
    {
        var allProducts = await _db.Products.ToDictionaryAsync(p => p.Id);
        var restaurants = await _db.Restaurants.ToListAsync();

        foreach (var rest in restaurants)
        {
            // 1. Блюда — фильтруем по ресторану и подгружаем ингредиенты
            var dishes = await _db.Dishes
                .Include(d => d.Ingredients)
                    .ThenInclude(ing => ing.Product)
                .Where(d => d.RestaurantId == rest.Id)
                .ToListAsync();

            var dishesForRedis = dishes.Select(d => (
                d.Id,
                d.Name,
                d.Ingredients.Select(ing => new DishItem(
                    ing.ProductId,
                    ing.Product?.Name ?? "Unknown",
                    ing.Quantity
                )).ToList()
            )).ToList();

            await _foodStock.SetDishAsync(rest.Id, dishesForRedis);

            var supplies = await _db.Supplies
                .Include(s => s.Batches)
                .Where(s => s.RestaurantId == rest.Id && s.SupplyStatus == (int)SupplyStatus.GotIt)
                .ToListAsync();

            foreach (var supply in supplies)
            {
                var products = supply.Batches.Select(i =>
                {
                    var prod = allProducts[i.ProductId];
                    return (
                        i.ProductId,
                        prod.Name,
                        i.FactQuantity,
                        i.ExpiresAt
                    );
                }).ToList();

                if (products.Any())
                    await _foodStock.AddProductsBySupplyAsync(rest.Id, supply.Id, products);
            }
        }

        var completedOrders = await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.RestaurantId != null && o.Status == "Completed")
            .ToListAsync();

        foreach (var order in completedOrders)
        {
            var items = order.Items.Select(i => new OrderItemDto(i.ProductId, i.Quantity, i.SupplyId)).ToList();
            await _foodStock.RemoveProductsByOrderItemsAsync(order.RestaurantId, items);
        }

        var rotRecords = await _db.RotRecords
            .Include(r => r.SupplyItem)
            .ToListAsync();

        var rotByRestaurant = rotRecords.GroupBy(r => r.RestaurantId);

        foreach (var group in rotByRestaurant)
        {
            var items = group.Select(r => (
                r.ProductId,
                r.SupplyItem.SupplyId,
                r.Quantity
            )).ToList();

            await _foodStock.DestroyRottingProductAsync(group.Key, items);
        }
    }

    public async Task StashInitializeAsync()
    {
        var orders = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Dishes)
            .ToListAsync();

        foreach (var order in orders)
        {
            await _analStash.AddOrderAsync(order.RestaurantId, order, order.CreatedAt);
        }

        var supplies = await _db.Supplies
            .Include(s => s.Batches)
            .Where(s => s.SupplyStatus == (int)SupplyStatus.GotIt)
            .ToListAsync();

        foreach (var supply in supplies)
        {
            await _analStash.AddSupplyAsync(supply.RestaurantId, supply, supply.CreatedAt);
        }

        var rotRecords = await _db.RotRecords.ToListAsync();
        foreach (var rot in rotRecords)
        {
            await _analStash.AddRotAsync(rot.RestaurantId, rot, rot.CreatedAt);
        }
    }
}