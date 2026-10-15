using System.Text.Json;
using System.Text.Json.Serialization;
using StackExchange.Redis;

namespace back.Infrastructure.Services.DaikonBaseContext;

public class AnalStash : IAnalStash
{
    private readonly IDatabase _db;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public AnalStash(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    #region Keys

    private string OrdersKey(Guid restId) => $"analytics:{restId}:orders";
    private string SuppliesKey(Guid restId) => $"analytics:{restId}:supplies";
    private string RotKey(Guid restId) => $"analytics:{restId}:rot";

    #endregion

    #region Set

    public async Task AddOrderAsync(Guid restId, object order, DateTime createdAt)
    {
        var json = JsonSerializer.Serialize(order, JsonOptions);
        await _db.SortedSetAddAsync(OrdersKey(restId), json, createdAt.Ticks);
    }

    public async Task AddSupplyAsync(Guid restId, object supply, DateTime createdAt)
    {
        var json = JsonSerializer.Serialize(supply, JsonOptions);
        await _db.SortedSetAddAsync(SuppliesKey(restId), json, createdAt.Ticks);
    }

    public async Task AddRotAsync(Guid restId, object rot, DateTime createdAt)
    {
        var json = JsonSerializer.Serialize(rot, JsonOptions);
        await _db.SortedSetAddAsync(RotKey(restId), json, createdAt.Ticks);
    }

    #endregion

    #region Get

    public async Task<List<T>> GetOrdersAsync<T>(Guid restId, DateTime? from = null, DateTime? to = null) =>
        await GetRangeAsync<T>(OrdersKey(restId), from, to);

    public async Task<List<T>> GetSuppliesAsync<T>(Guid restId, DateTime? from = null, DateTime? to = null) =>
        await GetRangeAsync<T>(SuppliesKey(restId), from, to);

    public async Task<List<T>> GetRotAsync<T>(Guid restId, DateTime? from = null, DateTime? to = null) =>
        await GetRangeAsync<T>(RotKey(restId), from, to);

    #endregion

    #region Helpers

    private async Task<List<T>> GetRangeAsync<T>(string key, DateTime? from, DateTime? to)
    {
        long minScore = 0;
        long maxScore = long.MaxValue;

        if (from.HasValue && to.HasValue)
        {
            minScore = from.Value.Ticks;
            maxScore = to.Value.Ticks;
        }
        else if (from.HasValue && !to.HasValue)
        {
            minScore = from.Value.Date.Ticks;
            maxScore = from.Value.Date.AddDays(1).Ticks;
        }

        var values = await _db.SortedSetRangeByScoreAsync(key, minScore, maxScore);
        return values
            .Select(v => JsonSerializer.Deserialize<T>(v.ToString(), JsonOptions))
            .Where(v => v != null)
            .Cast<T>()
            .ToList();
    }

    #endregion
}