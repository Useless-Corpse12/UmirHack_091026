using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

namespace back.Infrastructure.Services.InviteCodeWorker;

public class InviteCodeWorker(IConfiguration config, IMemoryCache mem) : IInviteCodeWorker
{
    public string GenerateToken(Guid restId, bool isAdmin)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JwtSettings:SecretKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        
        var jti = Guid.NewGuid().ToString();
        
        var claims = new List<Claim>
        {
            new("rest_id", restId.ToString()),
            new("is_admin", isAdmin.ToString()),
            new(JwtRegisteredClaimNames.Jti, jti)
        };

        var expires = DateTime.UtcNow.AddDays(28) ;

        var token = new JwtSecurityToken(
            issuer: config["JwtSettings:Issuer"],
            audience: config["JwtSettings:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );
        
        mem.Set("invite:" + jti, true, TimeSpan.FromDays(28)); //invitecods in memory cache
        
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public InvitePayload ValidateToken(string token)
    {
        var key = Encoding.UTF8.GetBytes(config["JwtSettings:SecretKey"]!);
        var tokenHandler = new JwtSecurityTokenHandler();

        var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidIssuer = config["JwtSettings:Issuer"],
            ValidateAudience = true,
            ValidAudience = config["JwtSettings:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        }, out _);
        
        var jti = principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrEmpty(jti))
            throw new SecurityTokenException("Токен не содержит jti.");
        
        var cacheKey = "invite:" + jti;
        if (!mem.TryGetValue(cacheKey, out _))
            throw new SecurityTokenException("Приглашение уже использовано или истекло.");
        
        mem.Remove(cacheKey);
        
        return new InvitePayload(
            restId: Guid.Parse(principal.FindFirst("rest_id")?.Value!),
            IsAdmin: bool.Parse(principal.FindFirst("is_admin").Value!)
        );
    }
}