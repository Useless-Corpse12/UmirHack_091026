namespace back.Domain.Entities;

public class RotRecord : Entity
{
    public Guid RestaurantId { get; set; }
    public Guid SupplyItemId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
    public string Reason { get; set; } = "Expired"; //Expired - выкинули. Ready - ждём одобрения
    public DateTime CreatedAt { get; set; }
}