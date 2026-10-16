using MediatR;
using back.Domain.Entities;

namespace back.Application.Authority.Restaurants.GetRestaurantMembers;

public record GetRestaurantMembersCommand(Guid RestaurantId) : IRequest<List<RestaurantMemberDto>>;

public record RestaurantMemberDto(
    Guid UserId,
    string Email,
    UserRole Role
);
