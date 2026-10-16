using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Security.Hasher;
using MediatR;

namespace back.Application.Authority.Restaurants;

public class CreatePOSHandler(AppDbContext dbContext, IPasswordHasher passwordHasher):IRequestHandler<CreatePOSCommand>
{
    public async Task Handle(CreatePOSCommand cmd, CancellationToken cnt)
    {
        var cashierUser = User.Create(
            Guid.NewGuid(),
            $"PointOfSale:{Guid.NewGuid()}",
            passwordHasher.Create(cmd.pincode)
        );
        cashierUser.IsVerified = true;
        
        var cashierRole = new UserRestaurant{
            UserId = cashierUser.Id,
            RestaurantId = cmd.restaurantId,
            Role = UserRole.Cashier
        };
        
        dbContext.Users.Add(cashierUser);
        dbContext.UserRestaurants.Add(cashierRole);
        dbContext.SaveChanges();
    }
}