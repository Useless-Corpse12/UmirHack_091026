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
            $"PointOfSale:{cmd.restaurantId}",
            passwordHasher.Create(cmd.pincode)
        );

        var cashierRole = new UserRestaurant{
            Id = Guid.NewGuid(),
            UserId = cashierUser.Id,
            RestaurantId = cmd.restaurantId,
            Role = UserRole.Cashier
        };
        
        dbContext.Users.Add(cashierUser);
        dbContext.UserRestaurants.Add(cashierRole);
        dbContext.SaveChanges();
    }
}