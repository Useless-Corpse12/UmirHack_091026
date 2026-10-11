namespace back.Domain.Entities;

public class Product: Entity
{
    public string Name { get; set; } = null!;
    public Guid RestaurantId { get; set; }
    public int ShelfLife { get; set; }
    
}