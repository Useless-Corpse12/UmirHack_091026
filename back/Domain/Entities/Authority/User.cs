namespace back.Domain.Entities;

public class User : Entity
{
    public string Email { get; set; }
    public string PasswordHash { get; set; }
}