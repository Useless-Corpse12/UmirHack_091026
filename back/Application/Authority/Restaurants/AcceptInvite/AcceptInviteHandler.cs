using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.InviteCodeWorker;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Restaurants.AcceptInvite;

public class AcceptInviteHandler(AppDbContext dbContext, IInviteCodeWorker invCodeWrkr):IRequestHandler<AcceptInviteCommand>
{
    public async Task Handle(AcceptInviteCommand cmd, CancellationToken cnt)
    {
        var result = invCodeWrkr.ValidateToken(cmd.token);
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == cmd.userId,cnt);
        var restaurant = await dbContext.Restaurants.FirstOrDefaultAsync(x => x.Id == result.restId,cnt);

        var newrole = new UserRestaurant
        {
            RestaurantId = result.restId,
            UserId = user.Id,
            User = user,
            Restaurant = restaurant,
            Role = result.IsAdmin ? UserRole.Admin : UserRole.Manager
        };
        
        user.Roles.Add(newrole);
        restaurant.Staff.Add(newrole);
        
        dbContext.Users.Update(user);
        dbContext.Restaurants.Update(restaurant);
        dbContext.UserRestaurants.Add(newrole);
        await dbContext.SaveChangesAsync();

    }
}