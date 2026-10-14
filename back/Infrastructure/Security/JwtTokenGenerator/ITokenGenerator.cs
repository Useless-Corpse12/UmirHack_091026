using back.Domain.Entities;

namespace back.Infrastructure.Security.JwtTokenGenerator;

public interface ITokenGenerator
{
    string GenerateAccessToken(Guid userId,string email);
    string GeneratePOSToken(Guid restId, Guid userId);
}