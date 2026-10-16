using MediatR;

namespace back.Application.RestaurantArea.POS.RemoveFromCart;

public record RemoveFromCartCommand(Guid RestaurantId, string CartId, Guid DishId) : IRequest<Unit>;
