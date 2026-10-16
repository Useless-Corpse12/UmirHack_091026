using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using back.Application.Authority.Authorize;
using back.Application.Authority.Restaurants.AcceptInvite;

namespace back.Presentation.Controllers;

public class AuthorityController(IMediator mediator) : ApiController
{
    [HttpPost("[action]")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterUser(RegisterSelfCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userId = await mediator.Send(cmd);
        return Ok(new 
        { 
            UserId = userId, 
            Message = "Регистрация успешна, код подтверждения выслан на почту" 
        });
    }
    
    [HttpPost("[action]")]
    [AllowAnonymous]
    public async Task<IActionResult> AuthorizeUser(AuthorizeCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var token = await mediator.Send(cmd);
        return Ok( new
            {
                accessToken = token
            }
        );
    }
    
    [HttpPost("[action]")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyUser(VerifySelfCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userId = await mediator.Send(cmd);
        return Ok(new 
        { 
            UserId = userId, 
            Message = "Аккаунт верифицирован" 
        });
    }
    
    [HttpPost("[action]")]
    [Authorize]
    public async Task<IActionResult> AcceptInvite(AcceptInviteCommand cmd)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        await mediator.Send(cmd);
        return Ok(new 
        { 
            Message = "Well cum" 
        });
    }
}