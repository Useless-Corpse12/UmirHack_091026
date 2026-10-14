namespace back.Domain.Entities;

public class Restaurant:Entity
{
    public string Name { get; set; }
    public string ApiSecret { get; set; }
    public ICollection<UserRestaurant> Staff { get; set; }= new List<UserRestaurant>();
}