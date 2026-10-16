using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace POS_immitation;

public record AuthorizePosRequest(Guid RestaurantId, string Pin);
public record AuthorizePosResponse(string AccessToken);
public record DishDto(Guid Id, string Name);
public record RecommendationDto(Guid DishId, string Name, double Score);
public record AddToCartRequest(Guid RestaurantId, string? CartId, Guid DishId);
public record RemoveFromCartRequest(Guid RestaurantId, string CartId, Guid DishId);
public record CreateOrderRequest(Guid RestaurantId, string CartId);
public record CancelOrderRequest(Guid RestId, string CartId);

public class ApiService
{
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public string? CurrentToken { get; set; }

    public ApiService(string baseUrl)
    {
        _client = new HttpClient { BaseAddress = new Uri(baseUrl) };
        _client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public void SetToken(string token)
    {
        CurrentToken = token;
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<AuthorizePosResponse?> AuthorizePosAsync(Guid restaurantId, string pin)
    {
        var content = CreateJsonContent(new AuthorizePosRequest(restaurantId, pin));
        var response = await _client.PostAsync("/api/pos/authorize-pos", content);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<AuthorizePosResponse>(json, JsonOptions);
            if (result != null) SetToken(result.AccessToken);
            return result;
        }
        return null;
    }

    public async Task<List<DishDto>> GetMenuAsync(Guid restaurantId)
    {
        var response = await _client.GetAsync($"/api/pos/menu?restaurantId={restaurantId}");
        return await DeserializeOrDefault<List<DishDto>>(response) ?? new List<DishDto>();
    }

    public async Task<List<RecommendationDto>> GetRecommendationsAsync(Guid restaurantId)
    {
        var response = await _client.GetAsync($"/api/pos/recommendations?restaurantId={restaurantId}");
        return await DeserializeOrDefault<List<RecommendationDto>>(response) ?? new List<RecommendationDto>();
    }

    public async Task<List<Guid>> GetStopListAsync(Guid restaurantId)
    {
        var response = await _client.GetAsync($"/api/pos/stoplist?restaurantId={restaurantId}");
        return await DeserializeOrDefault<List<Guid>>(response) ?? new List<Guid>();
    }

    public async Task<string?> AddToCartAsync(Guid restaurantId, string? currentCartId, Guid dishId)
    {
        var request = new AddToCartRequest(restaurantId, currentCartId, dishId);
        var content = CreateJsonContent(request);
        var response = await _client.PostAsync("/api/pos/add-to-cart", content);
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("cartId", out var cartIdProp))
                return cartIdProp.GetString();
        }
        return currentCartId;
    }

    public async Task<bool> RemoveFromCartAsync(Guid restaurantId, string cartId, Guid dishId)
    {
        var request = new RemoveFromCartRequest(restaurantId, cartId, dishId);
        var content = CreateJsonContent(request);
        var response = await _client.PostAsync("/api/pos/remove-from-cart", content);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> CreateOrderAsync(Guid restaurantId, string cartId)
    {
        var request = new CreateOrderRequest(restaurantId, cartId);
        var content = CreateJsonContent(request);
        var response = await _client.PostAsync("/api/pos/create-order", content);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> CancelCartAsync(Guid restaurantId, string cartId)
    {
        var request = new CancelOrderRequest(restaurantId, cartId);
        var content = CreateJsonContent(request);
        var response = await _client.PostAsync("/api/pos/cancel-order", content);
        return response.IsSuccessStatusCode;
    }

    private StringContent CreateJsonContent(object obj) =>
        new(JsonSerializer.Serialize(obj, JsonOptions), Encoding.UTF8, "application/json");

    private async Task<T?> DeserializeOrDefault<T>(HttpResponseMessage response) where T : class
    {
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<T>(json, JsonOptions);
        }
        return default;
    }
}