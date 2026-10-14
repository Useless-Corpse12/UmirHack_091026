namespace back.Domain.Entities;

public class RotRecord : RestaurantEntity
{
    public Guid SupplyItemId { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public bool Status { get; set; } = false; //True - выкинули. False - ждём одобрения
    public DateTime CreatedAt { get; set; }
    public Product Product { get; set; }
    public SupplyItem SupplyItem { get; set; }
}