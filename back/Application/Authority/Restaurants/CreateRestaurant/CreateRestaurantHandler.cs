using back.Data;
using back.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Restaurants;

public class CreateRestaurantHandler(AppDbContext dbContext)
    : IRequestHandler<CreateRestaurantCommand, Guid>
{
    public async Task<Guid> Handle(CreateRestaurantCommand cmd, CancellationToken cnt)
    {
        var userExists = await dbContext.Users
            .AnyAsync(u => u.Id == cmd.UserId, cnt);

        if (!userExists)
        {
            throw new Exception("Пользователь не найден");
        }

        var apiSecret = Guid.NewGuid().ToString("N");

        var restaurant = new Restaurant
        {
            Id = Guid.NewGuid(),
            Name = cmd.RestaurantName,
            ApiSecret = apiSecret
        };

        var userRestaurant = new UserRestaurant
        {
            UserId = cmd.UserId,
            RestaurantId = restaurant.Id,
            Role = UserRole.Owner
        };

        dbContext.Restaurants.Add(restaurant);
        dbContext.UserRestaurants.Add(userRestaurant);

        await dbContext.SaveChangesAsync(cnt);

        Console.WriteLine($"Создан ресторан: {restaurant.Name}, ID: {restaurant.Id}");
        Console.WriteLine($"ApiSecret для поставщика: {apiSecret}");

        return restaurant.Id;
    }
}