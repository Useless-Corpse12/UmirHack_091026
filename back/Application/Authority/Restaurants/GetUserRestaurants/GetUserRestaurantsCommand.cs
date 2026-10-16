using MediatR;
using back.Domain.Entities;

namespace back.Application.Authority.Restaurants;

public record GetUserRestaurantsCommand(Guid UserId) : IRequest<List<UserRestaurantDto>>;

public record UserRestaurantDto(
    Guid RestaurantId,
    string RestaurantName,
    UserRole Role,
    string ApiKey
);
