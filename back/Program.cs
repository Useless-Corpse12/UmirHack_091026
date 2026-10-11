using back.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

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

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();