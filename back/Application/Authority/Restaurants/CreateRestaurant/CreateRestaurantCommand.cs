using MediatR;

namespace back.Application.Authority.Restaurants;

public record CreateRestaurantCommand(
    Guid UserId,
    string RestaurantName
) : IRequest<Guid>;
