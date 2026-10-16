using MediatR;

namespace back.Application.RestaurantArea.SetProducts;

public record ProductTemplateDto(
    string Name,
    int ShelfLifeSeconds,
    string Unit
);

public record SetProductsCommand(
    Guid RestaurantId,
    List<ProductTemplateDto> Products
) : IRequest<Unit>;