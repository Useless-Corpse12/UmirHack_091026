using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;

namespace back.Application.RestaurantArea.POS.CreateOrder;

public class CreateOrderHandler(
    AppDbContext dbContext,
    IFoodStock foodStock,
    IAnalStash analStash)
    : IRequestHandler<CreateOrderCommand, Guid>
{
    public async Task<Guid> Handle(CreateOrderCommand cmd, CancellationToken cnt)
    {
        var reservations = await foodStock.CompleteCartAsync(cmd.RestaurantId, cmd.CartId);

        if (reservations.Count == 0)
        {
            throw new Exception("Корзина пуста, невозможно создать заказ");
        }

        var order = new Order
        {
            Id = Guid.NewGuid(),
            RestaurantId = cmd.RestaurantId,
            CreatedAt = DateTime.UtcNow,
            Status = "Completed",
            Items = new List<OrderItem>(),
            Dishes = new List<OrderDish>() 
        };

        foreach (var reservation in reservations)
        {
            foreach (var product in reservation.ReservedProducts)
            {
                order.Items.Add(new OrderItem
                {
                    Id = Guid.NewGuid(),
                    OrderId = order.Id,
                    ProductId = product.ProductId,
                    SupplyId = product.SupplyId,
                    Quantity = product.Quantity
                });
            }
        }
        
        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync(cnt);
        await analStash.AddOrderAsync(cmd.RestaurantId, new 
        { 
            order.Id, 
            order.Status, 
            ItemsCount = order.Items.Count 
        }, order.CreatedAt);

        return order.Id;
    }
}