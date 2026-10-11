using back.Domain.Entities;

namespace back.Infrastructure.Security.JwtTokenGenerator;

public interface ITokenGenerator
{
    string GenerateAccessToken(User user);
}