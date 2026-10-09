using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace back.Infrastructure.Services.EmailService;

public class EmailSender : IEmailSender
{
    private readonly EmailSettings _settings;
    private readonly ILogger<EmailSender> _logger;
    
    public EmailSender(IOptions<EmailSettings> settings, ILogger<EmailSender> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        using var message = new MailMessage
        {
            From = new MailAddress(_settings.FromEmail, _settings.FromName),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(_settings.SmtpServer, _settings.Port)
        {
            Credentials = new NetworkCredential(_settings.Username, _settings.Password),
            EnableSsl = _settings.EnableSsl
        };

        try
        {
            await client.SendMailAsync(message);
            _logger.LogInformation(":Succes: Email sent to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ":Fail: Failed to send email to {Email}", toEmail);
            throw;
        }
    }

    public async Task SendRegistrationCodeAsync(string toEmail, string code)
    {
        var subject = "Код подтверждения DOCSeal";
        var body = $@"
            <html>
            <body style='font-family: Arial, sans-serif;'>
            </body>
            </html>";

        await SendEmailAsync(toEmail, subject, body);
    }
}