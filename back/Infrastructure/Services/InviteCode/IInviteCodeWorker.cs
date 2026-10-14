namespace DOCSeal.Infrastructure.Services.InviteCodeGenerator;

public interface IInviteCodeWorker
{
    string GenerateToken(Guid restId, bool isAdmin);
    InvitePayload ValidateToken(string token);
}

public record InvitePayload(
    Guid restId, 
    bool IsAdmin
);