using back.Application.RestaurantArea;
using back.Application.RestaurantArea.Supplies;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using back.Application.RestaurantArea.Supplies.AcceptSupply;
using back.Application.RestaurantArea.Supplies.RejectSupply;

namespace back.Presentation.Controllers;

public class SupplyController(IMediator mediator) : ApiController
{

    [HttpPost("[action]")]
    [Authorize]
    public async Task<IActionResult> AcceptSupply(AcceptSupplyCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            await mediator.Send(cmd);
            return Ok(new { Message = "Поставка принята" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("[action]")]
    [Authorize]
    public async Task<IActionResult> RejectSupply(RejectSupplyCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            await mediator.Send(cmd);
            return Ok(new { Message = "Поставка отклонена" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}