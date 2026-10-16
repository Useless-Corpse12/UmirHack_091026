using MediatR;

namespace back.Application.Authority.Restaurants;

public record RemoveRestaurantMemberCommand(
    Guid UserId,
    Guid RestaurantId,
    Guid TargetUserId
) : IRequest<Unit>;
