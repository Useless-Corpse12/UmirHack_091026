using MediatR;

namespace back.Application.RestaurantArea.Supplies.AcceptSupply;

public record AcceptSupplyCommand(
    Guid SupplyId,
    Guid UserId,
    List<SupplyItemFactDto> Items
) : IRequest<Unit>;

public record SupplyItemFactDto(
    Guid ProductId,
    int FactQuantity
);
