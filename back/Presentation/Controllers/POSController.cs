using back.Application.RestaurantArea.POS.AddToCart;
using back.Application.RestaurantArea.POS.Authorize;
using back.Application.RestaurantArea.POS.CancelOrder;
using back.Application.RestaurantArea.POS.CreateOrder;
using back.Application.RestaurantArea.POS.GetRestaurantMenu;
using back.Application.RestaurantArea.POS.RemoveFromCart;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace back.Presentation.Controllers;

public class POSController(IMediator mediator) : ApiController
{
    [HttpGet("menu")]
    [Authorize]
    public async Task<IActionResult> GetMenu([FromQuery] Guid restaurantId)
    {
        var cmd = new GetRestaurantMenuCommand(restaurantId);
        var menu = await mediator.Send(cmd);
        return Ok(menu);
    }

    [HttpPost("add-to-cart")]
    [Authorize]
    public async Task<IActionResult> AddToCart(AddToCartCommand cmd)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var cartId = await mediator.Send(cmd);
        return Ok(new { CartId = cartId, Message = "Блюдо добавлено в корзину" });
    }

    [HttpPost("remove-from-cart")]
    [Authorize]
    public async Task<IActionResult> RemoveFromCart(RemoveFromCartCommand cmd)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        await mediator.Send(cmd);
        return Ok(new { Message = "Блюдо удалено из корзины" });
    }

    [HttpPost("create-order")]
    [Authorize]
    public async Task<IActionResult> CreateOrder(CreateOrderCommand cmd)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var orderId = await mediator.Send(cmd);
        return Ok(new { OrderId = orderId, Message = "Заказ успешно создан и оплачен" });
    }
    
    [HttpPost("cancel-order")]
    [Authorize]
    public async Task<IActionResult> CancelOrder(CancelOrderCommand cmd)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            await mediator.Send(cmd);
            return Ok(new { Message = "Заказ успешно отменён" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("authorize-pos")]
    [AllowAnonymous]
    public async Task<IActionResult> AuthorizePOS(AuthorizePOSCommand cmd)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var token = await mediator.Send(cmd);
            return Ok(new { accessToken = token });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
