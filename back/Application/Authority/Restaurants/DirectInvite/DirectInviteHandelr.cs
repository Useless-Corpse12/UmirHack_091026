using back.Data;
using back.Infrastructure.Services.EmailService;
using back.Infrastructure.Services.InviteCodeWorker;
using MediatR;
namespace back.Application.Authority.Restaurants.DirectInvite;

public class DirectInviteHandelr(
    IInviteCodeWorker codeWorker, 
    IEmailSender emailSender
    ):IRequestHandler<DirectInviteCommand>
{
    public async Task Handle(DirectInviteCommand cmd, CancellationToken cnt)
    {
        var inviteCode = codeWorker.GenerateToken(cmd.restaurantId, cmd.isAdmin);
        
        var name = cmd.restaurantId.ToString();//как с редисом справимся переделать
        var role = cmd.isAdmin ? "Администратор" : "Менеджер"; 
        
        var inviteLink = $"http://localhost:5067/invite?code={Uri.EscapeDataString(inviteCode)}";
        
        var subject = $"Приглашение в организацию {name}";
        var body = $"Вас приглашают в организацию \"{name}\" " +
                   $"на роль \"{role}\".\n\nПерейдите по ссылке: {inviteLink}\n" +
                   $"Или введите код на сайте: {inviteCode}" +
                   $"Ссылка действительна 28 дней";

        await emailSender.SendEmailAsync(cmd.email, subject, body);
    }
}