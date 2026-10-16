namespace back.Infrastructure.Services.DaikonBaseContext;

public interface IAnalStash
{
    Task AddOrderAsync(Guid restId, object order, DateTime createdAt);
    Task AddSupplyAsync(Guid restId, object supply, DateTime createdAt);
    Task AddRotAsync(Guid restId, object rot, DateTime createdAt);

    Task<List<T>> GetOrdersAsync<T>(Guid restId, DateTime? from = null, DateTime? to = null);
    Task<List<T>> GetSuppliesAsync<T>(Guid restId, DateTime? from = null, DateTime? to = null);
    Task<List<T>> GetRotAsync<T>(Guid restId, DateTime? from = null, DateTime? to = null);
}