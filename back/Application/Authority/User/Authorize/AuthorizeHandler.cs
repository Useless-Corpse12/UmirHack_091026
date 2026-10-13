using back.Data;
using back.Infrastructure.Security.Hasher;
using back.Infrastructure.Security.JwtTokenGenerator;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Authorize;

public class AuthorizationHandler(
    AppDbContext dbContext, 
    IPasswordHasher passwordHasher,
    ITokenGenerator tokenGenerator
): IRequestHandler<AuthorizeCommand, string>

{
    private AppDbContext DbContext { get; } = dbContext;
    
    public async Task<string> Handle(AuthorizeCommand cmd,CancellationToken cnt)
    {
        var user = await DbContext.Users.FirstOrDefaultAsync(x=>x.Email == cmd.Email, cancellationToken: cnt);
        
        if (user == null || !passwordHasher.Validate(cmd.Password, user.PasswordHash))
            throw new Exception("Неверный логин или пароль");
        
        var accessToken = tokenGenerator.GenerateAccessToken(user);
        
        
        return accessToken;
    }
}