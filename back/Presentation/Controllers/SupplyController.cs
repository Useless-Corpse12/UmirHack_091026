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
    [HttpPost("incoming")]
    [AllowAnonymous]
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

    [HttpGet("[action]")]
    [AllowAnonymous]
    public async Task<IActionResult> GetProducts(SupplierGetProductsCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var products = await mediator.Send(cmd);
            return Ok(products);
        }
        catch (Exception ex)
        {
            return BadRequest(new {Message = ex.Message});
        }
    }

    [HttpGet("[action]")]
    [Authorize]
    public async Task<IActionResult> GetPendingSupplies([FromQuery] Guid restaurantId)
    {
        try
        {
            var cmd = new GetPendingSuppliesCommand(restaurantId);
            var result = await mediator.Send(cmd);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

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