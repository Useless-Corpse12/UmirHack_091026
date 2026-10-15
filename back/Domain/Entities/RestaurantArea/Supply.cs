namespace back.Domain.Entities;

public class Supply : RestaurantEntity
{
    public string SupplyNumber { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public int SupplyStatus { get; set; } //приехало/не приняли/Частично приняли/приняли
    public ICollection<SupplyItem> Batches { get; set; } = new List<SupplyItem>();
}

public class SupplyItem : Entity
{
    public Guid SupplyId{set;get;}
    public Supply Supply { get; set; }
    public Guid ProductId { get; set; }
    public Product Product { get; set; }
    public int Quantity { get; set; }     //сколько приехало
    public int FactQuantity { get; set; } //сколько приняли
    public DateTime ExpiresAt { get; set; }
}

public enum SupplyStatus
{
    Created,   //приехало  
    Denial,    //не приняли
    Partial,   //частично приняли
    GotIt      //приняли
}