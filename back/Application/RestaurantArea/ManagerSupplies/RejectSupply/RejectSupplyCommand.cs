using MediatR;

namespace back.Application.RestaurantArea.Supplies.RejectSupply;

public record RejectSupplyCommand(
    Guid RestaurantId,
    Guid SupplyId,
    Guid UserId
) : IRequest<Unit>;
