using back.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Restaurants.GetRestaurantMembers;

public class GetRestaurantMembersHandler(AppDbContext dbContext) : IRequestHandler<GetRestaurantMembersCommand, List<RestaurantMemberDto>>
{
    public async Task<List<RestaurantMemberDto>> Handle(GetRestaurantMembersCommand cmd, CancellationToken cnt)
    {
        var members = await dbContext.UserRestaurants
            .Where(ur => ur.RestaurantId == cmd.RestaurantId)
            .Join(dbContext.Users,
                  ur => ur.UserId,
                  u => u.Id,
                  (ur, u) => new RestaurantMemberDto(u.Id, u.Email, ur.Role))
            .ToListAsync(cnt);

        return members;
    }
}