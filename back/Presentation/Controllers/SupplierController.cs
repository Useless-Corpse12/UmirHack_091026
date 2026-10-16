using back.Application.RestaurantArea;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace back.Presentation.Controllers;

public class SupplierController(IMediator mediator):ApiController
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
    public async Task<IActionResult> GetProducts(
        [FromQuery] Guid restaurantId, 
        [FromQuery] string apiKey)
    {
        var cmd = new SupplierGetProductsCommand(restaurantId, apiKey);
        var products = await mediator.Send(cmd);
        return Ok(products);
    }
}