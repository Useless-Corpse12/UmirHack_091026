using MediatR;

namespace back.Application.RestaurantArea.POS.GetRestaurantMenu;

public record GetRestaurantMenuCommand(Guid RestaurantId) : IRequest<List<DishDto>>;

public record DishDto(Guid DishId, string Name);
