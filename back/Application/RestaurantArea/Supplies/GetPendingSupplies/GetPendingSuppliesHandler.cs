using back.Data;
using back.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.Supplies;

public class GetPendingSuppliesHandler(AppDbContext dbContext) : IRequestHandler<GetPendingSuppliesCommand, List<PendingSupplyDto>>
{
    public async Task<List<PendingSupplyDto>> Handle(GetPendingSuppliesCommand cmd, CancellationToken cnt)
    {
        var supplies = await dbContext.Supplies
            .Include(s => s.Batches)
                .ThenInclude(b => b.Product)
            .Where(s => s.RestaurantId == cmd.RestaurantId &&
                        s.SupplyStatus == (int)SupplyStatus.Created)
            .ToListAsync(cnt);

        return supplies.Select(s => new PendingSupplyDto(
            s.Id,
            s.SupplyNumber,
            s.CreatedAt,
            s.SupplyStatus,
            s.Batches.Select(b => new PendingSupplyItemDto(
                b.ProductId,
                b.Product?.Name ?? "Unknown",
                b.Quantity,
                b.ExpiresAt
            )).ToList()
        )).ToList();
    }
}
