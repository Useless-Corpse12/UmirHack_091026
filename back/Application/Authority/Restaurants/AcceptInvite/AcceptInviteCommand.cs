using MediatR;

namespace back.Application.Authority.Restaurants.AcceptInvite;

public record AcceptInviteCommand(string token, Guid userId) : IRequest;
