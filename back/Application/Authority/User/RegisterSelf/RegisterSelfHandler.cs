
using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Security.Hasher;
using back.Infrastructure.Services.EmailService;
using back.Infrastructure.Services.VerificationCode;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority.Authorize;

public class RegistrationSelfHandler(
    AppDbContext dbContext, 
    IPasswordHasher passwordHasher, 
    IEmailSender emailSender,
    IVerificationCodeService verificationCodeService
    ):IRequestHandler<RegisterSelfCommand,Guid>

{
    private AppDbContext DbContext { get; } = dbContext;
    
    public async Task<Guid> Handle(RegisterSelfCommand cmd,CancellationToken cnt)
    {
        var existingUser = await dbContext.Users
            .FirstOrDefaultAsync(x => x.Email == cmd.Email, cancellationToken: cnt);
        
        if (existingUser != null)
        {
            if (existingUser.IsVerified)
                throw new Exception("Пользователь с таким email уже зарегистрирован");
            existingUser.PasswordHash = passwordHasher.Create(cmd.Password);
            
            verificationCodeService.RemoveCode(existingUser.Id);
            var code = verificationCodeService.GenerateAndSaveCode(existingUser.Id);
            
            dbContext.Users.Update(existingUser);
            await dbContext.SaveChangesAsync(cnt);
            
            await emailSender.SendRegistrationCodeAsync(existingUser.Email, code);
            Console.WriteLine($"Обновлён пользователь. Новый код: {code}");
            
            return existingUser.Id;
        }
        
        var user = User.Create(Guid.NewGuid(), cmd.Email, cmd.Password);
        
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cnt);
        
        var newCode = verificationCodeService.GenerateAndSaveCode(user.Id);
        
        await emailSender.SendRegistrationCodeAsync(user.Email, newCode);
        Console.WriteLine($"Создан пользователь. Код: {newCode}");
        
        return user.Id;
    }
}