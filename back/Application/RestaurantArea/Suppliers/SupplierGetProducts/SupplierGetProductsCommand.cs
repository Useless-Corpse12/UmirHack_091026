using MediatR;

namespace back.Application.RestaurantArea;

public record SupplierGetProductsCommand(
    Guid RestaurantId,
    string ApiKey
) : IRequest<List<ProductItemDto>>;

public record ProductItemDto(
    Guid ProductId,
    string ProductName,
    int ShelfLifeSeconds,
    string Units
);