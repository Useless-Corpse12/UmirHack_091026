using MediatR;

namespace back.Application.RestaurantArea;

public record SupplyIncomingCommand(
    Guid RestaurantId,
    string SupplyNumber,
    List<SupplyItemDto> Items
) : IRequest<Guid>;

public record SupplyItemDto(
    Guid ProductId,
    decimal Quantity
);