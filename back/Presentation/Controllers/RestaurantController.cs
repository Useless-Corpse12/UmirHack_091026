using back.Application.Authority.Restaurants;
using back.Application.Authority.Restaurants.DirectInvite;
using back.Application.Authority.Restaurants.GetRestaurantMembers;
using back.Application.RestaurantArea.Menu;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
    
    [HttpPost("[action]")]
    [Authorize]
    public async Task<IActionResult> DirectInvite(DirectInviteCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            await mediator.Send(cmd);
            return Ok(new
            {
                Message = $"Код успешно отправлен на {cmd.email}"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("[action]")]
    [Authorize]
    public async Task<IActionResult> GetRestaurantMembers([FromQuery] Guid restaurantId)
    {
        try
        {
            var cmd = new GetRestaurantMembersCommand(restaurantId);
            var result = await mediator.Send(cmd);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("[action]")]
    [Authorize]
    public async Task<IActionResult> GetUserRestaurants([FromQuery] Guid userId)
    {
        try
        {
            var cmd = new GetUserRestaurantsCommand(userId);
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
    public async Task<IActionResult> LoadRestaurantMenu(LoadRestaurantMenuCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            await mediator.Send(cmd);
            return Ok(new { Message = "Меню ресторана загружено" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpDelete("[action]")]
    [Authorize]
    public async Task<IActionResult> RemoveRestaurantMember(
    [FromQuery] Guid userId,
    [FromQuery] Guid restaurantId,
    [FromQuery] Guid targetUserId)
    {
        try
        {
            var cmd = new RemoveRestaurantMemberCommand(userId, restaurantId, targetUserId);
            await mediator.Send(cmd);
            return Ok(new { Message = "Сотрудник удалён из ресторана" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
