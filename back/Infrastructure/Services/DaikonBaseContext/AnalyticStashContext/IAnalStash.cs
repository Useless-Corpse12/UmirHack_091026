namespace back.Infrastructure.Services.DaikonBaseContext;

public interface IAnalStash
{
    Task AddOrderAsync(Guid restId, object order, DateTime createdAt);
    Task AddSupplyAsync(Guid restId, object supply, DateTime createdAt);
    Task AddRotAsync(Guid restId, object rot, DateTime createdAt);

    Task<List<T>> GetAllOrdersAsync<T>(Guid restId);
    Task<List<T>> GetAllSuppliesAsync<T>(Guid restId);
    Task<List<T>> GetAllRotAsync<T>(Guid restId);

    Task<List<T>> GetOrdersByDateAsync<T>(Guid restId, DateTime date);
    Task<List<T>> GetSuppliesByDateAsync<T>(Guid restId, DateTime date);
    Task<List<T>> GetRotByDateAsync<T>(Guid restId, DateTime date);

    Task<List<T>> GetOrdersByRangeAsync<T>(Guid restId, DateTime from, DateTime to);
    Task<List<T>> GetSuppliesByRangeAsync<T>(Guid restId, DateTime from, DateTime to);
    Task<List<T>> GetRotByRangeAsync<T>(Guid restId, DateTime from, DateTime to);
}