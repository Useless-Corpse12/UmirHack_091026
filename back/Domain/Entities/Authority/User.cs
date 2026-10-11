namespace back.Domain.Entities;

public class User : Entity
{
    public string email { get; set; }
    public string PasswordHash { get; set; }
}