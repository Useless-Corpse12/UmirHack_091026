using back.Data;
using back.Infrastructure.Services.VerificationCode;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.Authority;

public class VerifySelfHandler(
    AppDbContext dbContext, 
    IVerificationCodeService verificationCodeService
):IRequestHandler<VerifySelfCommand,Guid>

{
    private AppDbContext DbContext { get; } = dbContext;
    
    public async Task<Guid> Handle(VerifySelfCommand cmd,CancellationToken cnt)
    {
        var user =  await DbContext.Users.FirstOrDefaultAsync(x=>x.Email == cmd.Email, cancellationToken: cnt);
        if (user == null)
            throw new Exception("Такого пользователя нет");

        if (!verificationCodeService.ValidateCode(user.Id, cmd.VerificationCode))
            throw new Exception("Неверный код");
        
        verificationCodeService.RemoveCode(user.Id);
        user.IsVerified = true;
        
        DbContext.Users.Update(user);
        await DbContext.SaveChangesAsync(cnt);
        
        return user.Id;
    }
}