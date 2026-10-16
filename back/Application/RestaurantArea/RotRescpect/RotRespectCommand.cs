using MediatR;

namespace back.Application.RestaurantArea.RotRescpect;

public record RotRespectCommand(Guid RotRecordId):IRequest;