using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using back.Application.RestaurantArea;

namespace back.Presentation.Controllers;

public class SupplyController(IMediator mediator) : ApiController
{
    [HttpPost("incoming")]
    [Authorize]
    public async Task<IActionResult> CreateSupply(SupplyIncomingCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var supplyId = await mediator.Send(cmd);
            return Ok(new
            {
                SupplyId = supplyId,
                Message = "Поставка успешно создана"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}