namespace back.Domain.Entities;

public class UserRestaurant:Entity
{
    public Guid UserId { get; set; }
    public Guid RestaurantId { get; set; }
    public string RestaurantName { get; set; }
    public string Role { get; set; } = "Admin";
}