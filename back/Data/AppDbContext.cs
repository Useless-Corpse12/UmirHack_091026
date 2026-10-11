using back.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace back.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{

    public DbSet<User> Users => Set<User>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<UserRestaurant> UserRestaurants => Set<UserRestaurant>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Dish> Dishes => Set<Dish>();
    public DbSet<Supply> Supplies => Set<Supply>();
    public DbSet<SupplyItem> SupplyItems => Set<SupplyItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<RotRecord> RotRecords => Set<RotRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<UserRestaurant>()
            .HasKey(ur => new { ur.UserId, ur.RestaurantId });
    }
}