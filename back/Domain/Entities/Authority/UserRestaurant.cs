namespace back.Domain.Entities;

public class UserRestaurant:Entity
{
    public Guid UserId { get; set; }
    public Guid RestaurantId { get; set; }
    public UserRole Role { get; set; }
}

public enum UserRole
{
    Owner,     
    Admin,      
    Manager,    
    Cashier     
}