namespace back.Infrastructure.Services.EmailService;

public class EmailSettings
{
        public string SmtpServer { get; set; } = string.Empty;
        public int Port { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FromEmail { get; set; } = string.Empty;
        public string FromName { get; set; } = "SlopGrenade_MonitoringSystem";
        public bool EnableSsl { get; set; } = true;
}