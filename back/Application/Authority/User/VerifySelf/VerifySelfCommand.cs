using MediatR;

namespace back.Application.Authority.Authorize;

public record VerifySelfCommand(string Email, string VerificationCode): IRequest<Guid>;