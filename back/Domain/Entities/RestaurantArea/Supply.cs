namespace back.Domain.Entities;

public class Supply : RestaurantEntity
{
    public string SupplyNumber { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public bool SupplyStatus { get; set; } //false - created, true - accepted
    public ICollection<SupplyItem> Batches { get; set; } = new List<SupplyItem>();
}

public class SupplyItem : Entity
{
    public Guid SupplyId{set;get;}
    public Supply Supply { get; set; }
    public Guid ProductId { get; set; }
    public Product Product { get; set; }
    public int Quantity { get; set; }
    public DateTime ExpiresAt { get; set; }
}