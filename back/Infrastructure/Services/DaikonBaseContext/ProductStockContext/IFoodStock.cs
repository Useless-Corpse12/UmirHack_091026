namespace back.Infrastructure.Services.DaikonBaseContext;

public interface IFoodStock
{
    Task SetDishAsync(Guid restId, List<(Guid DishId, string DishName, List<DishItem> Recipe)> newDishes);
    Task<Dictionary<Guid, DishInfo>> GetDishesAsync(Guid restId);
    Task<List<Guid>> GetStopListAsync(Guid restId);
    Task<List<(Guid DishId, string Name, double Score)>> GetRecommendationsAsync(Guid restId);
    
    Task AddProductsBySupplyAsync(Guid restId, Guid supplyId, List<(Guid ProductId, string Name, int Quantity, DateTime ExpiresAt)> products);
    Task DestroyRottingProductAsync(Guid resId, List<(Guid ProductId, Guid SupplyId, int Quantity)> products);
    Task RemoveProductsByOrderItemsAsync(Guid restId, List<OrderItemDto> orderItems);
    
    Task<string> CreateCartAsync(Guid restId);
    Task AddDishToCartAsync(Guid restId, string cartId, Guid dishId);
    Task RemoveDishFromCartAsync(Guid restId, string cartId, Guid dishId);
    Task<List<CartReservation>> CompleteCartAsync(Guid restId, string cartId);
    Task CancelCartAsync(Guid restId, string cartId);
    
    Task<List<ProductItem>> GetProductsAsync(Guid restId);
}