namespace back.Domain.Entities;

public class Dish : RestaurantEntity
{
    public string Name { get; set; } = null!;
    public List<DishIngredientLink> Ingredients { get; set; } = new();
}

public class DishIngredientLink : Entity
{
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public Product Product { get; set; }
    public Guid DishId { get; set; }
    public Dish Dish { get; set; }
}