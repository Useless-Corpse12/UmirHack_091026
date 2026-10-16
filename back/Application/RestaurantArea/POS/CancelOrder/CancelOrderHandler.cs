using back.Infrastructure.Services;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.CancelOrder;

public class CancelOrderHandler(IFoodStock foodStock, INotificationService nut) : IRequestHandler<CancelOrderCommand>
{
    public async Task Handle(CancelOrderCommand cmd, CancellationToken cnt)
    {
        await foodStock.CancelCartAsync(cmd.restId, cmd.cartId);
        
        await nut.NotifyProductsChangedAsync(cmd.restId);
        await nut.NotifyStopListChangedAsync(cmd.restId);
        await nut.NotifyRecommendationsChangedAsync(cmd.restId);
    }
}