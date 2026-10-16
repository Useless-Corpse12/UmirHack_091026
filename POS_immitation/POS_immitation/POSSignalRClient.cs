
using Microsoft.AspNetCore.SignalR.Client;

namespace POS_immitation
{
    public class POSSignalRClient
    {
        private readonly HubConnection _connection;

        public event Action<List<Guid>>? OnStopListUpdated;
        public event Action<List<RecommendationDto>>? OnRecommendationsUpdated;

        public POSSignalRClient(string hubUrl, string token)
        {
            _connection = new HubConnectionBuilder()
                .WithUrl(hubUrl, options =>
                {
                    options.AccessTokenProvider = () => Task.FromResult(token);
                })
                .WithAutomaticReconnect()
                .Build();

            _connection.On<List<Guid>>("StopListUpdated", stopList =>
            {
                Console.WriteLine($"Получен обновлённый стоп-лист: {stopList.Count} блюд");
                OnStopListUpdated?.Invoke(stopList);
            });

            _connection.On<List<RecommendationDto>>("RecommendationsUpdated", recs =>
            {
                Console.WriteLine($"Получены рекомендации: {recs.Count} позиций");
                OnRecommendationsUpdated?.Invoke(recs);
            });
        }

        public async Task StartAsync(Guid restaurantId)
        {
            await _connection.StartAsync();
            await _connection.InvokeAsync("JoinRestaurant", restaurantId);
            Console.WriteLine($"Подключился к SignalR hub для ресторана {restaurantId}");
        }

        public async Task StopAsync()
        {
            await _connection.StopAsync();
            await _connection.DisposeAsync();
        }
    }
}