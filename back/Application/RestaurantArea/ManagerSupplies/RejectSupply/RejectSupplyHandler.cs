using back.Data;
using back.Domain.Entities;
using back.Infrastructure.Services.DaikonBaseContext;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.Supplies.RejectSupply;

public class RejectSupplyHandler(AppDbContext dbContext,IAnalStash analStash) : IRequestHandler<RejectSupplyCommand, Unit>
{
    public async Task<Unit> Handle(RejectSupplyCommand cmd, CancellationToken cnt)
    {
        var supply = await dbContext.Supplies
            .FirstOrDefaultAsync(s => s.Id == cmd.SupplyId && s.RestaurantId == cmd.RestaurantId, cnt);

        if (supply == null)
            throw new Exception("Поставка не найдена");

        if (supply.SupplyStatus != (int)SupplyStatus.Created)
            throw new Exception("Поставка уже обработана");

        var userRole = await dbContext.UserRestaurants
            .Where(ur => ur.UserId == cmd.UserId && ur.RestaurantId == supply.RestaurantId)
            .Select(ur => ur.Role)
            .FirstOrDefaultAsync(cnt);

        if (userRole != UserRole.Owner && userRole != UserRole.Admin)
            throw new Exception("Недостаточно прав для отклонения поставки");

        supply.SupplyStatus = (int)SupplyStatus.Denial;
        
        await dbContext.SaveChangesAsync(cnt);
        
        await analStash.AddSupplyAsync(supply.RestaurantId, new { supply.Id, Status = "Rejected" }, DateTime.UtcNow);
        
        return Unit.Value;
    }
}