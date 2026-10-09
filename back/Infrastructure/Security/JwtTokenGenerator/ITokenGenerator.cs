namespace back.Infrastructure.Security.JwtTokenGenerator;

public record TokenResult(string Token, DateTime ExpiresAt);

public interface ITokenGenerator
{
    string GenerateAccessToken(User user);
    TokenResult GenerateRefreshToken();
}