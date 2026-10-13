using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using back.Application.Authority.Restaurants;

namespace back.Presentation.Controllers;

public class RestaurantController(IMediator mediator) : ApiController
{
    [HttpPost("create")]
    [Authorize]
    public async Task<IActionResult> CreateRestaurant(CreateRestaurantCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var restaurantId = await mediator.Send(cmd);
            return Ok(new
            {
                RestaurantId = restaurantId,
                Message = "Ресторан успешно создан"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpDelete("{restaurantId}")]
    [Authorize]
    public async Task<IActionResult> DeleteRestaurant(Guid restaurantId, [FromQuery] Guid userId)
    {
        try
        {
            var cmd = new DeleteRestaurantCommand(userId, restaurantId);
            await mediator.Send(cmd);
            return Ok(new { Message = "Ресторан удалён" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
    
    [HttpPost("[action]")]
    [Authorize]
    public async Task<IActionResult> CreatePOS(CreatePOSCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            await mediator.Send(cmd);
            return Ok(new
            {
                Message = "Кассовая точка создана"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
