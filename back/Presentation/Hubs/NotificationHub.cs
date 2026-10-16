using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace back.Presentation.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public async Task JoinRestaurant(Guid restaurantId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"restaurant_{restaurantId}");
    }

    public async Task LeaveRestaurant(Guid restaurantId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"restaurant_{restaurantId}");
    }
}