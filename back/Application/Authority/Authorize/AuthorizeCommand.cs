using MediatR;

namespace back.Application.Authority;

public record AuthorizeCommand(string Email, string Password): IRequest<string>;
