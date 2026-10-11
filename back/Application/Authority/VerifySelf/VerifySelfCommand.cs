using MediatR;

namespace back.Application.Authority;

public record VerifySelfCommand(string Email, string VerificationCode): IRequest<Guid>;