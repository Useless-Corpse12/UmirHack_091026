namespace back.Domain.Entities;

public class Order : Entity
{
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "Created"; 
    public Guid RestaurantId { get; set; }
    
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Dish> Dishes { get; set; } = new List<Dish>();
}
public class OrderItem :  Entity
{
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public Guid SupplyId { get; set; }
}