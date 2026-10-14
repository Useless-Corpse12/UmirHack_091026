namespace back.Domain.Entities;

public abstract class RestaurantEntity : Entity
{
    public Guid RestaurantId { get; set; }
    public Restaurant Restaurant { get; set; }
}