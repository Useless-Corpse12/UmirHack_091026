using MediatR;

namespace back.Application.Authority;

public record RegisterSelfCommand(string Email, string Password):IRequest<Guid>;