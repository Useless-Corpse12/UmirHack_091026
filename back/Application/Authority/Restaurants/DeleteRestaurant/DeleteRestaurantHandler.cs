using back.Data;
using back.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Restaurants;

public class DeleteRestaurantHandler(AppDbContext dbContext)
    : IRequestHandler<DeleteRestaurantCommand, Unit>
{
    public async Task<Unit> Handle(DeleteRestaurantCommand cmd, CancellationToken cnt)
    {
        var userRestaurant = await dbContext.UserRestaurants
            .FirstOrDefaultAsync(ur => ur.UserId == cmd.UserId && ur.RestaurantId == cmd.RestaurantId, cnt);

        if (userRestaurant == null)
        {
            throw new Exception("Пользователь не имеет доступа к этому ресторану");
        }

        if (userRestaurant.Role != UserRole.Owner && userRestaurant.Role != UserRole.Admin)
        {
            throw new Exception("Только владелец или администратор может удалить ресторан");
        }

        dbContext.Products.RemoveRange(
            dbContext.Products.Where(p => p.RestaurantId == cmd.RestaurantId));
        dbContext.Dishes.RemoveRange(
            dbContext.Dishes.Where(d => d.RestaurantId == cmd.RestaurantId));
        dbContext.Supplies.RemoveRange(
            dbContext.Supplies.Where(s => s.RestaurantId == cmd.RestaurantId));
        dbContext.Orders.RemoveRange(
            dbContext.Orders.Where(o => o.RestaurantId == cmd.RestaurantId));
        dbContext.UserRestaurants.Remove(userRestaurant);
        dbContext.Restaurants.RemoveRange(
            dbContext.Restaurants.Where(r => r.Id == cmd.RestaurantId));

        await dbContext.SaveChangesAsync(cnt);

        Console.WriteLine($"Ресторан {cmd.RestaurantId} удалён");

        return Unit.Value;
    }
}