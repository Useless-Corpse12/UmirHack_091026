using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.AddToCart;

public class AddToCartHandler(IFoodStock foodStock) : IRequestHandler<AddToCartCommand, string>
{
    public async Task<string> Handle(AddToCartCommand cmd, CancellationToken cnt)
    {
        var cartId = cmd.CartId ?? await foodStock.CreateCartAsync(cmd.RestaurantId);

        await foodStock.AddDishToCartAsync(cmd.RestaurantId, cartId, cmd.DishId);

        return cartId;
    }
}
