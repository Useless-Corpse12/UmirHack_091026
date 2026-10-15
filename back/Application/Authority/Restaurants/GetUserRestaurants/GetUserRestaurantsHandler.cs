using back.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Restaurants;

public class GetUserRestaurantsHandler(AppDbContext dbContext) : IRequestHandler<GetUserRestaurantsCommand, List<UserRestaurantDto>>
{
    public async Task<List<UserRestaurantDto>> Handle(GetUserRestaurantsCommand cmd, CancellationToken cnt)
    {
        var restaurants = await dbContext.UserRestaurants
            .Where(ur => ur.UserId == cmd.UserId)
            .Join(dbContext.Restaurants,
                  ur => ur.RestaurantId,
                  r => r.Id,
                  (ur, r) => new UserRestaurantDto(r.Id, r.Name, ur.Role))
            .ToListAsync(cnt);

        return restaurants;
    }
}
