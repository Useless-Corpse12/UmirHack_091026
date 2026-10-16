using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace POS_immitation;

// Запросы и ответы для авторизации по Email/Паролю
public record AuthorizeUserRequest(string Email, string Password);
public record AuthorizeUserResponse(string Token, Guid? RestaurantId);

// DTO для меню и заказов
public record DishDto(Guid Id, string Name, decimal Price);
public record RecommendationDto(Guid DishId, string Name, double Score);

// Прямой чекаут без корзины (старые AddToCart/CreateOrder теперь 410 Gone)
public record CheckoutRequest(Guid RestaurantId, List<DishOrderItem> Dishes);
public record DishOrderItem(Guid DishId, int Quantity);

public class ApiService
{
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public string? CurrentToken { get; set; }
    public Guid? CurrentRestaurantId { get; set; }

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

    /// <summary>
    /// Авторизация кассира по Email и PIN-коду (как обычный пользователь)
    /// </summary>
    public async Task<AuthorizeUserResponse?> AuthorizeUserAsync(string email, string password)
    {
        var content = CreateJsonContent(new AuthorizeUserRequest(email, password));
        var response = await _client.PostAsync("/api/Authority/AuthorizeUser", content);
        
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<AuthorizeUserResponse>(json, JsonOptions);
            
            if (result != null && !string.IsNullOrEmpty(result.Token))
            {
                SetToken(result.Token);
                CurrentRestaurantId = result.RestaurantId;
            }
            return result;
        }
        return null;
    }

    /// <summary>
    /// Получение активного меню для POS
    /// </summary>
    public async Task<List<DishDto>> GetMenuAsync(Guid restaurantId)
    {
        var response = await _client.GetAsync($"/api/POS/{restaurantId}/menu");
        return await DeserializeOrDefault<List<DishDto>>(response) ?? new List<DishDto>();
    }

    /// <summary>
    /// Получение рекомендаций (блюда с истекающим сроком)
    /// </summary>
    public async Task<List<RecommendationDto>> GetRecommendationsAsync(Guid restaurantId)
    {
        var response = await _client.GetAsync($"/api/POS/{restaurantId}/recommendations");
        return await DeserializeOrDefault<List<RecommendationDto>>(response) ?? new List<RecommendationDto>();
    }

    /// <summary>
    /// Получение стоп-листа (блюда, которые нельзя приготовить)
    /// </summary>
    public async Task<List<Guid>> GetStopListAsync(Guid restaurantId)
    {
        var response = await _client.GetAsync($"/api/POS/{restaurantId}/stoplist");
        return await DeserializeOrDefault<List<Guid>>(response) ?? new List<Guid>();
    }

    /// <summary>
    /// Оформление заказа напрямую (без корзины). 
    /// Отправляет список блюд и количество, сервер сам делает FEFO-списание.
    /// </summary>
    public async Task<bool> CheckoutAsync(Guid restaurantId, List<DishOrderItem> dishes)
    {
        if (dishes == null || dishes.Count == 0) return false;

        var request = new CheckoutRequest(restaurantId, dishes);
        var content = CreateJsonContent(request);
        var response = await _client.PostAsync("/api/POS/checkout", content);
        
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