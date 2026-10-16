namespace back.Infrastructure.Services.EmailService;



public interface IEmailSender
{ 
    Task SendEmailAsync(string toEmail, string subject, string body); 
    Task SendRegistrationCodeAsync(string toEmail, string code);
}