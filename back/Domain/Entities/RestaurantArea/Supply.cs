namespace back.Domain.Entities;

public class Supply : Entity
{
    public string SupplyNumber { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public Guid RestaurantId { get; set; }
    
    public ICollection<SupplyItem> Batches { get; set; } = new List<SupplyItem>();
}

public class SupplyItem
{
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
}