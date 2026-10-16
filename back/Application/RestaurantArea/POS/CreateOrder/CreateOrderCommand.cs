using MediatR;

namespace back.Application.RestaurantArea.POS.CreateOrder;

public record CreateOrderCommand(Guid RestaurantId, string CartId) : IRequest<Guid>;
