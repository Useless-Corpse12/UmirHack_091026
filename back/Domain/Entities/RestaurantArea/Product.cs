namespace back.Domain.Entities;

public class Product: RestaurantEntity
{
    public string Name { get; set; } = null!;
    public int ShelfLifeSeconds { get; set; }
    public string Units {get;set;}
}