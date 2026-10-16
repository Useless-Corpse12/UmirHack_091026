using back.Data;
using back.Infrastructure.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace back.Application.RestaurantArea.RotRescpect;

public class RotRespectHandler(AppDbContext dbContext, INotificationService nut):IRequestHandler<RotRespectCommand>
{
    public async Task Handle(RotRespectCommand cmd, CancellationToken cnt)
    {
        var rotRecord = await dbContext.RotRecords.FirstOrDefaultAsync(r => r.Id == cmd.RotRecordId,cnt)??
                        throw new Exception("Ди нах");
        
        rotRecord.Status = true;
        
        dbContext.RotRecords.Update(rotRecord);
        await dbContext.SaveChangesAsync(cnt);
        
        await nut.NotifyAnalyticsChangedAsync(rotRecord.RestaurantId);
    }
}