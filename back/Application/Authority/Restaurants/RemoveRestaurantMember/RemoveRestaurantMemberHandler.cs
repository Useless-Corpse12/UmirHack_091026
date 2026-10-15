using back.Data;
using back.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Restaurants;

public class RemoveRestaurantMemberHandler(AppDbContext dbContext) : IRequestHandler<RemoveRestaurantMemberCommand, Unit>
{
    public async Task<Unit> Handle(RemoveRestaurantMemberCommand cmd, CancellationToken cnt)
    {
        var removerRole = await dbContext.UserRestaurants
            .Where(ur => ur.UserId == cmd.UserId && ur.RestaurantId == cmd.RestaurantId)
            .Select(ur => ur.Role)
            .FirstOrDefaultAsync(cnt);

        if (removerRole == null)
        {
            throw new Exception("Пользователь не имеет доступа к этому ресторану");
        }

        var targetRole = await dbContext.UserRestaurants
            .Where(ur => ur.UserId == cmd.TargetUserId && ur.RestaurantId == cmd.RestaurantId)
            .Select(ur => ur.Role)
            .FirstOrDefaultAsync(cnt);

        if (targetRole == null)
        {
            throw new Exception("Целевой пользователь не найден в этом ресторане");
        }

        bool canRemove = false;

        switch (removerRole)
        {
            case UserRole.Owner:
                canRemove = targetRole != UserRole.Owner;
                break;

            case UserRole.Admin:
                canRemove = targetRole == UserRole.Manager || targetRole == UserRole.Cashier;
                break;

            case UserRole.Manager:
            case UserRole.Cashier:
                canRemove = false;
                break;
        }

        if (!canRemove)
        {
            throw new Exception($"Недостаточно прав для удаления пользователя с ролью {targetRole}");
        }

        var userRestaurant = await dbContext.UserRestaurants
            .FirstOrDefaultAsync(ur => ur.UserId == cmd.TargetUserId && ur.RestaurantId == cmd.RestaurantId, cnt);

        if (userRestaurant != null)
        {
            dbContext.UserRestaurants.Remove(userRestaurant);
            await dbContext.SaveChangesAsync(cnt);
        }

        return Unit.Value;
    }
}
