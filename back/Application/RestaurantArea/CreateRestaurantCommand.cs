using MediatR;

namespace back.Application.RestaurantArea;

public record CreateRestaurantCommand(
    Guid UserId,
    string RestaurantName
) : IRequest<Guid>;
