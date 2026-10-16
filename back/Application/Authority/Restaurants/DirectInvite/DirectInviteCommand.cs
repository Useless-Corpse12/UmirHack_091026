using MediatR;

namespace back.Application.Authority.Restaurants.DirectInvite;

public record DirectInviteCommand(Guid restaurantId, string email, bool isAdmin):IRequest;