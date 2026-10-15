using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.Menu;

public class LoadRestaurantMenuHandler(AppDbContext dbContext, IFoodStock foodStock) : IRequestHandler<LoadRestaurantMenuCommand, Unit>
{
    public async Task<Unit> Handle(LoadRestaurantMenuCommand cmd, CancellationToken cnt)
    {
        var products = await dbContext.Products
            .Where(p => p.RestaurantId == cmd.RestaurantId)
            .ToListAsync(cnt);

        var productByName = products
            .GroupBy(p => p.Name)
            .ToDictionary(g => g.Key, g => g.First());

        var oldDishIds = await dbContext.Dishes
            .Where(d => d.RestaurantId == cmd.RestaurantId)
            .Select(d => d.Id)
            .ToListAsync(cnt);

        if (oldDishIds.Any())
        {
            var oldLinks = dbContext.DishIngredientLinks
                .Where(l => oldDishIds.Contains(l.DishId));
            dbContext.DishIngredientLinks.RemoveRange(oldLinks);

            var oldDishes = dbContext.Dishes
                .Where(d => d.RestaurantId == cmd.RestaurantId);
            dbContext.Dishes.RemoveRange(oldDishes);

            await dbContext.SaveChangesAsync(cnt);
        }

        var dishesForRedis = new List<(Guid DishId, string DishName, List<DishItem> Recipe)>();

        foreach (var (dishName, ingredients) in cmd.Menu)
        {
            var dish = new Dish
            {
                Id = Guid.NewGuid(),
                RestaurantId = cmd.RestaurantId,
                Name = dishName
            };

            var recipe = new List<DishItem>();

            foreach (var (ingredientName, quantity) in ingredients)
            {
                if (!productByName.TryGetValue(ingredientName, out var product))
                {
                    throw new Exception($"Продукт '{ingredientName}' не найден в ресторане");
                }

                var link = new DishIngredientLink
                {
                    Id = Guid.NewGuid(),
                    DishId = dish.Id,
                    ProductId = product.Id,
                    Quantity = quantity
                };

                dbContext.DishIngredientLinks.Add(link);

                recipe.Add(new DishItem(product.Id, product.Name, quantity));
            }

            dbContext.Dishes.Add(dish);
            dishesForRedis.Add((dish.Id, dish.Name, recipe));
        }

        await dbContext.SaveChangesAsync(cnt);

        await foodStock.SetDishAsync(cmd.RestaurantId, dishesForRedis);

        return Unit.Value;
    }
}
