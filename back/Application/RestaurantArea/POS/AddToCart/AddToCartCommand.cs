using MediatR;
using StackExchange.Redis;

namespace back.Application.RestaurantArea.POS.AddToCart;

public record AddToCartCommand(Guid RestaurantId, string? CartId, Guid DishId) : IRequest<string>;

