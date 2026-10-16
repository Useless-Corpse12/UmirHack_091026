using Microsoft.Extensions.Caching.Memory;

namespace back.Infrastructure.Services.VerificationCode;

public class VerificationCodeWorker(IMemoryCache cache):IVerificationCodeService
{
    public string GenerateAndSaveCode(Guid userId)
    {
        var code = new Random().Next(100000, 999999).ToString();
        
        var cacheKey = $"vrf_code:{userId}";
//                                                                                                  \/
        var cacheOptions = new MemoryCacheEntryOptions().SetAbsoluteExpiration(TimeSpan.FromMinutes(10));//   <==
//                                                                                                  /\
        cache.Set(cacheKey, code, cacheOptions);
        
        return code;
    }
    
    public bool ValidateCode(Guid userId, string code)
    {
        var cacheKey = $"vrf_code:{userId}";
        
        if (cache.TryGetValue(cacheKey, out string? cachedCode))
        {
            return cachedCode == code;
        }
        
        return false;
    }
    
    public void RemoveCode(Guid userId)
    {
        var cacheKey = $"vrf_code:{userId}";
        
        cache.Remove(cacheKey);
    }
}