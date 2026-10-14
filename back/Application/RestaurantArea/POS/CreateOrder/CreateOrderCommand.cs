using MediatR;

namespace back.Application.RestaurantArea.POS.CreateOrder;

public record CreateOrderCommand(Guid RestaurantId, string CartId, Guid DishId) : IRequest<Guid>;
