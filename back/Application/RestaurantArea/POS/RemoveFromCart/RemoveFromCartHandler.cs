using back.Infrastructure.Services;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.RemoveFromCart;

public class RemoveFromCartHandler(IFoodStock foodStock,INotificationService nut) : IRequestHandler<RemoveFromCartCommand, Unit>
{
    public async Task<Unit> Handle(RemoveFromCartCommand cmd, CancellationToken cnt)
    {
        await foodStock.RemoveDishFromCartAsync(cmd.RestaurantId, cmd.CartId, cmd.DishId);
        await nut.NotifyProductsChangedAsync(cmd.RestaurantId);
        await nut.NotifyStopListChangedAsync(cmd.RestaurantId);
        await nut.NotifyRecommendationsChangedAsync(cmd.RestaurantId);
        return Unit.Value;
    }
}
