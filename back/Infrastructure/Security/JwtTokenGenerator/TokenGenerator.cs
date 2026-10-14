using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using back.Domain.Entities;

namespace back.Infrastructure.Security.JwtTokenGenerator;

public class TokenGenerator(IConfiguration configuration) : ITokenGenerator
{
    private readonly IConfiguration _configuration = configuration;

    public string GenerateAccessToken(Guid userId,string email)
    {
        var claims = new List<Claim>
        {
            new("UserId", userId.ToString()),
            new("Email", email)
        };

        return BuildToken(claims);
    }

    public string GeneratePOSToken(Guid restId, Guid userId)
    {
        var claims = new List<Claim>
        {
            new("UserId", userId.ToString()),
            new("RestaurantId", restId.ToString()),
            new(ClaimTypes.Role, "Cashier")
        };

        return BuildToken(claims);
    }

    private string BuildToken(List<Claim> claims)
    {
        var secretKey = _configuration["JwtSettings:SecretKey"];
        var issuer = _configuration["JwtSettings:Issuer"];
        var audience = _configuration["JwtSettings:Audience"];
        var expirationDays = int.Parse(
            _configuration["JwtSettings:TokenLifeTimeDays"] ?? "30");

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expirationDays),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}