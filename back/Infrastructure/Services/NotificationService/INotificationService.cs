namespace back.Infrastructure.Services;

public interface INotificationService
{
    Task NotifyProductsChangedAsync(Guid restaurantId);
    Task NotifyStopListChangedAsync(Guid restaurantId);
    Task NotifyRecommendationsChangedAsync(Guid restaurantId);
    Task NotifyAnalyticsChangedAsync(Guid restaurantId);
}