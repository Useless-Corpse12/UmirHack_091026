using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.RemoveFromCart;

public class RemoveFromCartHandler(IFoodStock foodStock) : IRequestHandler<RemoveFromCartCommand, Unit>
{
    public async Task<Unit> Handle(RemoveFromCartCommand cmd, CancellationToken cnt)
    {
        await foodStock.RemoveDishFromCartAsync(cmd.RestaurantId, cmd.CartId, cmd.DishId);
        return Unit.Value;
    }
}
