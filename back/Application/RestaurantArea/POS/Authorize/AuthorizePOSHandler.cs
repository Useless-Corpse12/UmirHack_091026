using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Security.Hasher;
using back.Infrastructure.Security.JwtTokenGenerator;
using Microsoft.EntityFrameworkCore;
using MediatR;

namespace back.Application.RestaurantArea.POS.Authorize;

public class AuthorizePOSHandler(
    AppDbContext dbContext,
    IPasswordHasher passwordHasher,
    ITokenGenerator tokenGenerator
) : IRequestHandler<AuthorizePOSCommand, string>
{
    public async Task<string> Handle(AuthorizePOSCommand cmd, CancellationToken cnt)
    {
        var pinHash = passwordHasher.Create(cmd.pin);
        
        var cashier = await dbContext.Users
            .Join(dbContext.UserRestaurants, 
                u => u.Id, 
                ur => ur.UserId, 
                (u, ur) => new { u, ur })
            .Where(x => x.u.PasswordHash == pinHash 
                        && x.ur.RestaurantId == cmd.restId
                        && x.ur.Role == UserRole.Cashier)
            .Select(x => x.u)
            .FirstOrDefaultAsync(cnt) ?? throw new Exception("Неверный пин или кассир не найден");
        
        return tokenGenerator.GeneratePOSToken(cmd.restId, cashier.Id);

    }

}