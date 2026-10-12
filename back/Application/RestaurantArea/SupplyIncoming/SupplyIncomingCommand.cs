using MediatR;

namespace back.Application.RestaurantArea;

public record SupplyIncomingCommand(
    Guid RestaurantId,
    string SupplyNumber,
    string ApiKey,
    List<SupplyItemDto> Items
) : IRequest<Guid>;

public record SupplyItemDto(
    Guid ProductId,
    decimal Quantity
);