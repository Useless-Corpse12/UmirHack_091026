using MediatR;

namespace back.Application.RestaurantArea.Supplies;

public record GetPendingSuppliesCommand(Guid RestaurantId) : IRequest<List<PendingSupplyDto>>;

public record PendingSupplyDto(
    Guid SupplyId,
    string SupplyNumber,
    DateTime CreatedAt,
    int Status,
    List<PendingSupplyItemDto> Items
);

public record PendingSupplyItemDto(
    Guid ProductId,
    string ProductName,
    int Quantity,
    DateTime ExpiresAt
);
