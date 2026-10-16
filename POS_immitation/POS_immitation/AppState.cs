using System;

namespace POS_immitation;

public static class AppState
{
    public static ApiService Api { get; } = new ApiService("http://localhost:5067");
    public static POSSignalRClient? SignalR { get; set; }
    public static Guid RestaurantId { get; set; }
    public static string? CurrentCartId { get; set; }
    
    public static List<DishDto> Menu { get; set; } = new();
    public static List<Guid> StopList { get; set; } = new();
    public static List<RecommendationDto> Recommendations { get; set; } = new();
    public static List<DishDto> Cart { get; set; } = new();

    public static void Clear()
    {
        RestaurantId = Guid.Empty;
        CurrentCartId = null;
        Menu.Clear();
        StopList.Clear();
        Recommendations.Clear();
        Cart.Clear();
        Api.CurrentToken = null;
        SignalR?.StopAsync();
        SignalR = null;
    }
}