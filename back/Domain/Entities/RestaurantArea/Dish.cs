namespace back.Domain.Entities;

public class Dish : Entity
{
    public string Name { get; set; } = null!;
    public Guid RestaurantId { get; set; }
    
    public List<DishIngredientLink> Ingredients { get; set; } = new();
}

public class DishIngredientLink : Entity
{
    public Guid ProductId { get; set; }
    public decimal Quanity { get; set; }
}