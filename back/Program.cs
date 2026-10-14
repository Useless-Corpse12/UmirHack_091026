using System.Text;
using back.Data;
using back.Infrastructure.Security.Hasher;
using back.Infrastructure.Security.JwtTokenGenerator;
using back.Infrastructure.Services.DaikonBaseContext;
using back.Infrastructure.Services.EmailService;
using back.Infrastructure.Services.VerificationCode;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;


var builder = WebApplication.CreateBuilder(args);

#region SlonikDb




var dbConfig = builder.Configuration.GetSection("db");

if (string.IsNullOrEmpty(dbConfig["host"]) || string.IsNullOrEmpty(dbConfig["password"]))
    throw new InvalidOperationException("Database configuration is missing in appsettings.Development.json");

var dbConnString = $"Host={builder.Configuration.GetValue<string>("db:host")};" +
                   $"Port={builder.Configuration.GetValue("db:port", 5432)};" +
                   $"Database={builder.Configuration.GetValue<string>("db:name")};" +
                   $"Username={builder.Configuration.GetValue<string>("db:login")};" +
                   $"Password={builder.Configuration.GetValue<string>("db:password")};";

builder.Services.AddDbContext<AppDbContext>(options => 
    options.UseNpgsql(dbConnString));


#endregion

#region DaikonBase

var redisConnectionString = builder.Configuration.GetValue<string>("Redis:ConnectionString") 
                            ?? "localhost:6379";

builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(redisConnectionString));

builder.Services.AddSingleton<IFoodStock, FoodStock>();

#endregion

builder.Services.AddScoped<IDaikonInitializer, DaikonInitializer>();

builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));

var salt = builder.Configuration.GetValue<string>("salt") 
           ?? throw new InvalidOperationException("Соль не найдена!");

builder.Services.AddSingleton<IPasswordHasher>(new PasswordHasher(salt));

builder.Services.AddMemoryCache();

builder.Services.AddScoped<IEmailSender, EmailSender>();

builder.Services.AddScoped<IVerificationCodeService, VerificationCodeWorker>();

builder.Services.AddScoped<ITokenGenerator, TokenGenerator>();


builder.Services.AddMediatR(cfg => 
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

var jwtSecretKey = builder.Configuration["JwtSettings:SecretKey"];
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"];
var jwtAudience = builder.Configuration["JwtSettings:Audience"];

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey))
        };
    });

builder.Services.AddAuthorization();
// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<IDaikonInitializer>();
    await initializer.StockInitializeAsync();
    await initializer.StashInitializeAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();