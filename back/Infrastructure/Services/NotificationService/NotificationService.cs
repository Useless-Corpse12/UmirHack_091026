
using back.Infrastructure.Services.DaikonBaseContext;
using Microsoft.AspNetCore.SignalR;
using back.Presentation.Hubs;

namespace back.Infrastructure.Services;

public class NotificationService(
    IHubContext<NotificationHub> hubContext,
    IFoodStock foodStock,
    IAnalStash analStash) : INotificationService
{
    public async Task NotifyProductsChangedAsync(Guid restaurantId)
    {
        var products = await foodStock.GetProductsAsync(restaurantId);
        await hubContext.Clients.Group($"restaurant_{restaurantId}")
            .SendAsync("ProductsUpdated", products);
    }

    public async Task NotifyStopListChangedAsync(Guid restaurantId)
    {
        var stopList = await foodStock.GetStopListAsync(restaurantId);
        await hubContext.Clients.Group($"restaurant_{restaurantId}")
            .SendAsync("StopListUpdated", stopList);
    }

    public async Task NotifyRecommendationsChangedAsync(Guid restaurantId)
    {
        var recommendations = await foodStock.GetRecommendationsAsync(restaurantId);
        await hubContext.Clients.Group($"restaurant_{restaurantId}")
            .SendAsync("RecommendationsUpdated", recommendations);
    }

    public async Task NotifyAnalyticsChangedAsync(Guid restaurantId)
    {
        var orders = await analStash.GetOrdersAsync<object>(restaurantId);
        var supplies = await analStash.GetSuppliesAsync<object>(restaurantId);
        var rot = await analStash.GetRotAsync<object>(restaurantId);

        await hubContext.Clients.Group($"restaurant_{restaurantId}")
            .SendAsync("AnalyticsUpdated", new { Orders = orders, Supplies = supplies, Rot = rot });
    }
}