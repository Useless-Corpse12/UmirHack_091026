using System.Text;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;

namespace back.Infrastructure.Security.Hasher;

public class Hasher
{
    public static string Create(string value, string salt)
    {
       return Convert.ToBase64String(KeyDerivation.Pbkdf2
       (
           password:           value, 
           salt:               Encoding.UTF8.GetBytes(salt),
           prf:                KeyDerivationPrf.HMACSHA512, 
           iterationCount:     210000, 
           numBytesRequested:  256 / 8
       ));
    }

    public static bool Validate(string value,string salt ,string hash) => Create(value,salt) == hash;
}