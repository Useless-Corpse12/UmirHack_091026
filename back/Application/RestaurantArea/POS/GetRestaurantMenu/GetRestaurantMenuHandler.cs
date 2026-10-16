using back.Application.RestaurantArea.POS.GetRestaurantMenu;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.GetRestaurantMenu;

public class GetRestaurantMenuHandler(IFoodStock foodStock) : IRequestHandler<GetRestaurantMenuCommand, List<DishDto>>
{
    public async Task<List<DishDto>> Handle(GetRestaurantMenuCommand cmd, CancellationToken cnt)
    {
        var dishes = await foodStock.GetDishesAsync(cmd.RestaurantId);

        return dishes.Select(kvp => new DishDto(kvp.Key, kvp.Value.Name)).ToList();
    }
}
