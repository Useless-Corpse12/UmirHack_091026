namespace back.Domain.Entities;

public class UserRestaurant
{
    public Guid UserId { get; set; }
    public Guid RestaurantId { get; set; }
    public UserRole Role { get; set; }
    
    public User User { get; set; }
    public Restaurant Restaurant { get; set; }
}

public enum UserRole
{
    Owner,     
    Admin,      
    Manager,    
    Cashier     
}