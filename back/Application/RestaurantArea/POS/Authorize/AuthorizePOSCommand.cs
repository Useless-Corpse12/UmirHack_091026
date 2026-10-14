using MediatR;

namespace back.Application.RestaurantArea.POS.Authorize;

public record AuthorizePOSCommand(Guid restId, string pin):IRequest<string>;