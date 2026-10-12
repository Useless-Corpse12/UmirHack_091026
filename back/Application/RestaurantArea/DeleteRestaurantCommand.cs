using MediatR;

namespace back.Application.RestaurantArea;

public record DeleteRestaurantCommand(
    Guid UserId,
    Guid RestaurantId
) : IRequest<Unit>;