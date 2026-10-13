using MediatR;

namespace back.Application.Authority.Restaurants;

public record CreatePOSCommand(string pincode,Guid restaurantId):IRequest;