using System.Text.Json;
using StackExchange.Redis;

namespace back.Infrastructure.Services.DaikonBaseContext;

public class AnalStash: IAnalStash
{
    private readonly IDatabase _db;

    public AnalStash(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    #region Keys

    private string OrdersKey(Guid restId) => $"analytics:{restId}:orders";
    private string SuppliesKey(Guid restId) => $"analytics:{restId}:supplies";
    private string RotKey(Guid restId) => $"analytics:{restId}:rot";

    #endregion

    #region 3 Methods: Writing Data

    public async Task AddOrderAsync(Guid restId, object order, DateTime createdAt)
    {
        var json = JsonSerializer.Serialize(order);
        await _db.SortedSetAddAsync(OrdersKey(restId), json, createdAt.Ticks);
    }

    public async Task AddSupplyAsync(Guid restId, object supply, DateTime createdAt)
    {
        var json = JsonSerializer.Serialize(supply);
        await _db.SortedSetAddAsync(SuppliesKey(restId), json, createdAt.Ticks);
    }

    public async Task AddRotAsync(Guid restId, object rot, DateTime createdAt)
    {
        var json = JsonSerializer.Serialize(rot);
        await _db.SortedSetAddAsync(RotKey(restId), json, createdAt.Ticks);
    }

    #endregion

    #region 9 Methods: Reading Data
    
    public async Task<List<T>> GetAllOrdersAsync<T>(Guid restId) => 
        await GetRangeAsync<T>(OrdersKey(restId), 0, long.MaxValue);

    public async Task<List<T>> GetAllSuppliesAsync<T>(Guid restId) => 
        await GetRangeAsync<T>(SuppliesKey(restId), 0, long.MaxValue);

    public async Task<List<T>> GetAllRotAsync<T>(Guid restId) => 
        await GetRangeAsync<T>(RotKey(restId), 0, long.MaxValue);

    
    public async Task<List<T>> GetOrdersByDateAsync<T>(Guid restId, DateTime date)
    {
        var start = date.Date.Ticks;
        var end = date.Date.AddDays(1).Ticks;
        return await GetRangeAsync<T>(OrdersKey(restId), start, end);
    }

    public async Task<List<T>> GetSuppliesByDateAsync<T>(Guid restId, DateTime date)
    {
        var start = date.Date.Ticks;
        var end = date.Date.AddDays(1).Ticks;
        return await GetRangeAsync<T>(SuppliesKey(restId), start, end);
    }

    public async Task<List<T>> GetRotByDateAsync<T>(Guid restId, DateTime date)
    {
        var start = date.Date.Ticks;
        var end = date.Date.AddDays(1).Ticks;
        return await GetRangeAsync<T>(RotKey(restId), start, end);
    }

    
    public async Task<List<T>> GetOrdersByRangeAsync<T>(Guid restId, DateTime from, DateTime to) => 
        await GetRangeAsync<T>(OrdersKey(restId), from.Ticks, to.Ticks);

    public async Task<List<T>> GetSuppliesByRangeAsync<T>(Guid restId, DateTime from, DateTime to) => 
        await GetRangeAsync<T>(SuppliesKey(restId), from.Ticks, to.Ticks);

    public async Task<List<T>> GetRotByRangeAsync<T>(Guid restId, DateTime from, DateTime to) => 
        await GetRangeAsync<T>(RotKey(restId), from.Ticks, to.Ticks);

    #endregion

    #region Helpers

    private async Task<List<T>> GetRangeAsync<T>(string key, long minScore, long maxScore)
    {
        var values = await _db.SortedSetRangeByScoreAsync(key, minScore, maxScore);
        return values
            .Select(v => JsonSerializer.Deserialize<T>(v.ToString()))
            .Where(v => v != null)
            .Cast<T>()
            .ToList();
    }

    #endregion
}