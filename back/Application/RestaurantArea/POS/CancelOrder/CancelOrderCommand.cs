using MediatR;

namespace back.Application.RestaurantArea.POS.CancelOrder;

public record CancelOrderCommand(Guid restId,string cartId):IRequest;