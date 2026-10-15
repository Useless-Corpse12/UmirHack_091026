using MediatR;

namespace back.Application.RestaurantArea.Menu;

public record LoadRestaurantMenuCommand(
    Guid RestaurantId,
    Dictionary<string, Dictionary<string, int>> Menu
) : IRequest<Unit>;
