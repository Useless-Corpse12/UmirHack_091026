using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.CancelOrder;

public class CancelOrderHandler(IFoodStock foodStock) : IRequestHandler<CancelOrderCommand>
{
    public async Task Handle(CancelOrderCommand cmd, CancellationToken cnt)
    {
        await foodStock.CancelCartAsync(cmd.restId, cmd.cartId);
    }
}