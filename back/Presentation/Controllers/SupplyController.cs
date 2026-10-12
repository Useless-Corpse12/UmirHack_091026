using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using back.Application.RestaurantArea;

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
}