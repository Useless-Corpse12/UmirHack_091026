using MediatR;

namespace back.Application.Authority.Authorize;

public record RegisterSelfCommand(string Email, string Password):IRequest<Guid>;