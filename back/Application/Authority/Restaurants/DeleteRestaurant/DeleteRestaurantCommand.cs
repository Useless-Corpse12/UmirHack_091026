using MediatR;

namespace back.Application.Authority.Restaurants;

public record DeleteRestaurantCommand(
    Guid UserId,
    Guid RestaurantId
) : IRequest<Unit>;