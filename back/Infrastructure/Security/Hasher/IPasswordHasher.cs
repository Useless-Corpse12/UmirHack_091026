namespace back.Infrastructure.Security.Hasher;

public interface IPasswordHasher
{
    string Create(string value);
    bool Validate(string value, string hash);
}