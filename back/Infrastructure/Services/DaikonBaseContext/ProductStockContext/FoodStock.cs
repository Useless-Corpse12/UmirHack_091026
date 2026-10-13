using System.Text.Json;
using StackExchange.Redis;

namespace back.Infrastructure.Services.DaikonBaseContext;

public record ProductItem(Guid SupplyId, Guid ProductId, string ProductName, int Quantity, DateTime ExpiresAt );
public record OrderItemDto(Guid ProductId, int Quantity, Guid SupplyId);
public record DishItem(Guid ProductId, string ProductName, int Quantity);

public record DishInfo(string Name, List<DishItem> Recipe);

public record CartReservation(Guid DishId, string DishName, List<DishItem> Recipe, List<ProductItem> ReservedProducts );

public class FoodStock : IFoodStock
{
    private readonly IDatabase _db;

    public FoodStock(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    #region Keys

    private string StockKey(Guid restId) => $"restaurant:{restId}:stock";
    private string CartKey(Guid restId, string cartId) => $"restaurant:{restId}:cart:{cartId}";
    private string DishesKey(Guid restId) => $"restaurant:{restId}:dishes";

    #endregion

    #region Products

    public async Task AddProductsBySupplyAsync(
        Guid restId,
        Guid supplyId,
        List<(Guid ProductId, string Name, int Quantity, DateTime ExpiresAt)> products)
    {
        var key = StockKey(restId);
        
        foreach (var p in products)
        {
            var item = new ProductItem(supplyId, p.ProductId, p.Name, p.Quantity, p.ExpiresAt);
            var json = JsonSerializer.Serialize(item);
            var score = new DateTimeOffset(p.ExpiresAt).ToUnixTimeSeconds();
            
            await _db.SortedSetAddAsync(key, json, score);
        }
    }

    public async Task<string> CreateCartAsync(Guid restId)
    {
        var cartId = Guid.NewGuid().ToString();
        await _db.KeyExpireAsync(CartKey(restId, cartId), TimeSpan.FromMinutes(30));
        return cartId;
    }

    public async Task AddDishToCartAsync(Guid restId, string cartId, Guid dishId)
    {
        var dishes = await GetDishesAsync(restId);
        if (!dishes.TryGetValue(dishId, out var dishInfo))
            throw new InvalidOperationException($"Блюдо {dishId} не найдено в меню");

        var stockKey = StockKey(restId);
        var allStockRaw = await _db.SortedSetRangeByScoreAsync(stockKey);
        var stockItems = allStockRaw
            .Select(j => JsonSerializer.Deserialize<ProductItem>(j.ToString()))
            .Where(i => i != null)
            .Cast<ProductItem>()
            .ToList();

        var reservedProducts = new List<ProductItem>();

        foreach (var ing in dishInfo.Recipe)
        {
            var availableBatches = stockItems
                .Where(i => i.ProductId == ing.ProductId)
                .OrderBy(i => i.ExpiresAt)
                .ToList();

            int remainingToReserve = ing.Quantity;
            foreach (var batch in availableBatches)
            {
                if (remainingToReserve <= 0) break;

                int take = Math.Min(remainingToReserve, batch.Quantity);
                var oldJson = JsonSerializer.Serialize(batch);
                await _db.SortedSetRemoveAsync(stockKey, oldJson);
                
                reservedProducts.Add(new ProductItem(batch.SupplyId, batch.ProductId, batch.ProductName, take, batch.ExpiresAt));
                
                if (batch.Quantity > take)
                {
                    var remainingBatch = batch with { Quantity = batch.Quantity - take };
                    var score = new DateTimeOffset(remainingBatch.ExpiresAt).ToUnixTimeSeconds();
                    await _db.SortedSetAddAsync(stockKey, JsonSerializer.Serialize(remainingBatch), score);
                }

                remainingToReserve -= take;
            }
        }

        var reservation = new CartReservation(dishId, dishInfo.Name, dishInfo.Recipe, reservedProducts);
        await _db.HashSetAsync(CartKey(restId, cartId), dishId.ToString(), JsonSerializer.Serialize(reservation));
    }

    public async Task RemoveDishFromCartAsync(Guid restId, string cartId, Guid dishId)
    {
        var cartKey = CartKey(restId, cartId);
        var stockKey = StockKey(restId);

        var reservedJson = await _db.HashGetAsync(cartKey, dishId.ToString());
        if (reservedJson.IsNullOrEmpty) return;

        var reservation = JsonSerializer.Deserialize<CartReservation>(reservedJson.ToString());
        if (reservation == null) return;

        foreach (var item in reservation.ReservedProducts)
        {
            var json = JsonSerializer.Serialize(item);
            var score = new DateTimeOffset(item.ExpiresAt).ToUnixTimeSeconds();
            await _db.SortedSetAddAsync(stockKey, json, score);
        }

        await _db.HashDeleteAsync(cartKey, dishId.ToString());
    }

    public async Task<List<CartReservation>> CompleteCartAsync(Guid restId, string cartId)
    {
        var cartKey = CartKey(restId, cartId);
        var cartEntries = await _db.HashGetAllAsync(cartKey);

        if (cartEntries.Length == 0) 
            return new List<CartReservation>();

        var reservations = new List<CartReservation>();

        foreach (var entry in cartEntries)
        {
            var reservation = JsonSerializer.Deserialize<CartReservation>(entry.Value.ToString());
            if (reservation != null) { reservations.Add(reservation); }
        }

        await _db.KeyDeleteAsync(cartKey);
        return reservations;
    }

    public async Task CancelCartAsync(Guid restId, string cartId)
    {
        var cartKey = CartKey(restId, cartId);
        var stockKey = StockKey(restId);
        var cartEntries = await _db.HashGetAllAsync(cartKey);

        foreach (var entry in cartEntries)
        {
            var reservation = JsonSerializer.Deserialize<CartReservation>(entry.Value.ToString());
            if (reservation != null)
            {
                foreach (var item in reservation.ReservedProducts)
                {
                    var json = JsonSerializer.Serialize(item);
                    var score = new DateTimeOffset(item.ExpiresAt).ToUnixTimeSeconds();
                    await _db.SortedSetAddAsync(stockKey, json, score);
                }
            }
        }

        await _db.KeyDeleteAsync(cartKey);
    }

    public async Task<List<ProductItem>> GetProductsAsync(Guid restId)
    {
        var key = StockKey(restId);
        var items = await _db.SortedSetRangeByScoreAsync(key);
        
        return items
            .Select(j => JsonSerializer.Deserialize<ProductItem>(j.ToString()))
            .Where(i => i != null)
            .Cast<ProductItem>()
            .ToList();
    }

    public async Task DestroyRottingProductAsync(Guid resId, List<(Guid ProductId, Guid SupplyId, int Quantity)> products)
    {
        var key = StockKey(resId);
        var stock = (await _db.SortedSetRangeByScoreAsync(key))
            .Select(j => JsonSerializer.Deserialize<ProductItem>(j.ToString())!)
            .ToList();

        foreach (var (prodId, supId, qty) in products)
        {
            int left = qty;
            foreach (var batch in stock.Where(i => i.ProductId == prodId && i.SupplyId == supId)
                         .OrderBy(i => i.ExpiresAt))
            {
                if (left <= 0) break;

                int take = Math.Min(left, batch.Quantity);
                await _db.SortedSetRemoveAsync(key, JsonSerializer.Serialize(batch));

                if (batch.Quantity > take)
                    await _db.SortedSetAddAsync(key,
                        JsonSerializer.Serialize(batch with { Quantity = batch.Quantity - take }),
                        new DateTimeOffset(batch.ExpiresAt).ToUnixTimeSeconds());

                left -= take;
            }
        }
    }
    
    public async Task RemoveProductsByOrderItemsAsync(Guid restId, List<OrderItemDto> orderItems)
    {
        var key = StockKey(restId);
        var stock = (await _db.SortedSetRangeByScoreAsync(key))
            .Select(j => JsonSerializer.Deserialize<ProductItem>(j.ToString())!)
            .ToList();

        foreach (var item in orderItems)
        {
            int left = item.Quantity;
            foreach (var batch in stock.Where(i => i.ProductId == item.ProductId && i.SupplyId == item.SupplyId)
                         .OrderBy(i => i.ExpiresAt))
            {
                if (left <= 0) break;

                int take = Math.Min(left, batch.Quantity);
                await _db.SortedSetRemoveAsync(key, JsonSerializer.Serialize(batch));

                if (batch.Quantity > take)
                    await _db.SortedSetAddAsync(key,
                        JsonSerializer.Serialize(batch with { Quantity = batch.Quantity - take }),
                        new DateTimeOffset(batch.ExpiresAt).ToUnixTimeSeconds());

                left -= take;
            }
        }
    }
    
    #endregion

    
    
    
    #region Theory (Menu & Analytics)

    public async Task SetDishAsync(Guid restId, List<(Guid DishId, string DishName, List<DishItem> Recipe)> newDishes)
    {
        var key = DishesKey(restId);
        await _db.KeyDeleteAsync(key);
        
        foreach (var dish in newDishes)
        {
            var info = new DishInfo(dish.DishName, dish.Recipe);
            var json = JsonSerializer.Serialize(info);
            await _db.HashSetAsync(key, dish.DishId.ToString(), json);
        }
    }

    public async Task<Dictionary<Guid, DishInfo>> GetDishesAsync(Guid restId)
    {
        var entries = await _db.HashGetAllAsync(DishesKey(restId));
        var result = new Dictionary<Guid, DishInfo>();

        foreach (var entry in entries)
        {
            if (Guid.TryParse(entry.Name.ToString(), out var dishId))
            {
                var info = JsonSerializer.Deserialize<DishInfo>(entry.Value.ToString());
                if (info != null)
                {
                    result[dishId] = info;
                }
            }
        }

        return result;
    }
    
    public async Task<List<Guid>> GetStopListAsync(Guid restId)
    {
        var allDishes = await GetDishesAsync(restId);
        var stockItems = await GetProductsAsync(restId);
        var stopList = new List<Guid>();

        foreach (var (dishId, dishInfo) in allDishes)
        {
            bool isAvailable = true;
            foreach (var ing in dishInfo.Recipe)
            {
                int availableQuantity = stockItems
                    .Where(i => i.ProductId == ing.ProductId)
                    .Sum(i => i.Quantity);

                if (availableQuantity < ing.Quantity)
                {
                    isAvailable = false;
                    break;
                }
            }

            if (!isAvailable)
            {
                stopList.Add(dishId);
            }
        }

        return stopList;
    }

    public async Task<List<(Guid DishId, string Name, double Score)>> GetRecommendationsAsync(Guid restId)
    {
        var allDishes = await GetDishesAsync(restId);
        var stockItems = await GetProductsAsync(restId);
        var currentTime = DateTime.UtcNow;
        var results = new List<(Guid DishId, string Name, double Score)>();

        foreach (var (dishId, dishInfo) in allDishes)
        {
            double totalScore = 0;

            foreach (var ing in dishInfo.Recipe)
            {
                var supplies = stockItems
                    .Where(i => i.ProductId == ing.ProductId && i.Quantity > 0)
                    .OrderBy(i => i.ExpiresAt)
                    .ToList();

                if (!supplies.Any()) continue;

                var mostExpiringBatch = supplies.First();
                int totalQuantity = supplies.Sum(p => p.Quantity);

                double hoursRemaining = Math.Max(1.0, (mostExpiringBatch.ExpiresAt - currentTime).TotalHours);
                double urgency = 100.0 / hoursRemaining;
                double portionsSaved = (double)totalQuantity / ing.Quantity;

                totalScore += urgency * portionsSaved;
            }

            if (totalScore > 0)
            {
                results.Add((dishId, dishInfo.Name, Math.Round(totalScore, 2)));
            }
        }

        return results.OrderByDescending(r => r.Score).ToList();
    }
    
    #endregion
}