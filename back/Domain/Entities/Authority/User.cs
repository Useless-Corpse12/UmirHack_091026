namespace back.Domain.Entities;

public class User : Entity
{
    public string Email { get; set; }
    public string PasswordHash { get; set; }
    public bool IsVerified { get; set; }
    public ICollection<UserRestaurant> Roles { get; set; }= new List<UserRestaurant>();
    
    public static User Create(Guid id, string email, string passwordHash)
    {
        return new User
        {
            Id = id,
            Email = email,
            PasswordHash = passwordHash,
            IsVerified = false,
        };
    }
    
    protected User(){}
}