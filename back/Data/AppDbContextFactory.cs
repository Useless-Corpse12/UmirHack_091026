using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System.IO;

namespace back.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();

        var host = configuration["db:host"] ?? "localhost";
        var port = configuration["db:port"] ?? "5432";
        var dbName = configuration["db:name"] ?? "monitoring_db";
        var login = configuration["db:login"] ?? "postgres";
        var password = configuration["db:password"] ?? "postgres";

        var connectionString = $"Host={host};Port={port};Database={dbName};Username={login};Password={password}";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }
}