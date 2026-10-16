namespace back.Domain.Entities;

public class Order : RestaurantEntity
{
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "Created"; 
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderDish> Dishes { get; set; } = new List<OrderDish>();
}
public class OrderItem :  Entity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; }
    public Guid ProductId { get; set; }
    public Product Product { get; set; }
    public int Quantity { get; set; }
    public Guid SupplyId { get; set; }
    public Supply Supply { get; set; }
}

public class OrderDish: Entity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; }
    public Guid DishId { get; set; }
    public Dish Dish { get; set; }
    public int Quantity { get; set; }
}