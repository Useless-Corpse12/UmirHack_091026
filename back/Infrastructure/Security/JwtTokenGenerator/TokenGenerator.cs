using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

namespace back.Infrastructure.Security.JwtTokenGenerator;

public class TokenGenerator(IConfiguration configuration, IMemoryCache mem) : ITokenGenerator
{
    private readonly IConfiguration _configuration = configuration;

    public string GenerateAccessToken(Guid userId,string email)
    {
        var jti = Guid.NewGuid().ToString();
        var claims = new List<Claim>
        {
            new("UserId", userId.ToString()),
            new("Email", email),
            new(JwtRegisteredClaimNames.Jti, jti)
        };

        var secretKey = _configuration["JwtSettings:SecretKey"];
        var expirationDays = int.Parse( _configuration["JwtSettings:TokenLifeTimeDays"] ?? "30");
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["JwtSettings:Issuer"],
            audience: _configuration["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expirationDays),
            signingCredentials: credentials
        );
        
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GeneratePOSToken(Guid restId, Guid userId)
    {
        var jti = Guid.NewGuid().ToString();
        var claims = new List<Claim>
        {
            new("UserId", userId.ToString()),
            new("RestaurantId", restId.ToString()),
            new(ClaimTypes.Role, "Cashier"),
            new(JwtRegisteredClaimNames.Jti, jti)
        };
        
        var secretKey = _configuration["JwtSettings:SecretKey"];

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["JwtSettings:Issuer"],
            audience: _configuration["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(100),//<< 100 дней токен живёт
            signingCredentials: credentials
        );
        
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
    
}