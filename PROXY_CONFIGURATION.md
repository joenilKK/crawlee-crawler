# Proxy Configuration Guide

This crawler now supports comprehensive proxy configuration with rotation, retry logic, and health monitoring.

## Features

- ✅ **Multiple Proxy Support**: Use multiple proxy URLs with automatic rotation
- ✅ **Proxy Rotation Strategies**: perRequest, perPage, or perSession
- ✅ **Automatic Retry Logic**: Retry failed requests with different proxies
- ✅ **Proxy Health Monitoring**: Track proxy success/failure rates
- ✅ **Automatic Blacklisting**: Temporarily blacklist failed proxies
- ✅ **Proxy Bypass**: Skip proxy for specific URLs (localhost, etc.)
- ✅ **Country Selection**: Specify proxy country for geo-targeting
- ✅ **Comprehensive Statistics**: Detailed proxy usage statistics

## Configuration

### Input Schema (Apify)

The crawler accepts proxy configuration through the Apify input schema:

```json
{
  "outputFilename": "my-data",
  "proxyConfiguration": {
    "useProxy": true,
    "proxyUrls": [
      "http://username:password@proxy1.example.com:8080",
      "http://proxy2.example.com:3128",
      "socks5://username:password@proxy3.example.com:1080"
    ],
    "proxyCountry": "US",
    "proxyRotation": "perRequest",
    "proxyRetryCount": 3,
    "proxyTimeout": 30
  }
}
```

### Local Configuration

You can also configure proxies in `src/config/local-config.js`:

```javascript
proxy: {
    enabled: true,
    urls: [
        'http://username:password@proxy1.example.com:8080',
        'http://proxy2.example.com:3128',
        'socks5://username:password@proxy3.example.com:1080'
    ],
    country: 'US',
    rotation: 'perRequest', // 'perRequest', 'perPage', or 'perSession'
    retryCount: 3,
    timeout: 30000,
    retryDelay: 5000,
    bypassUrls: ['localhost', '127.0.0.1'],
    maxConcurrentRequests: 1,
    healthCheckInterval: 60000,
    blacklistFailedProxies: true,
    blacklistDuration: 300000
}
```

## Proxy Rotation Strategies

### perRequest
- Uses a different proxy for each individual request
- Best for maximum anonymity and load distribution
- Recommended for most use cases

### perPage
- Uses the same proxy for all requests on a single page
- Resets to a new proxy for each new page
- Good balance between performance and anonymity

### perSession
- Uses the same proxy for the entire crawling session
- Best for performance and maintaining session state
- Use when you need consistent IP throughout the crawl

## Proxy URL Formats

The crawler supports multiple proxy URL formats:

### HTTP/HTTPS Proxies
```
http://proxy.example.com:8080
http://username:password@proxy.example.com:8080
https://proxy.example.com:3128
```

### SOCKS5 Proxies
```
socks5://proxy.example.com:1080
socks5://username:password@proxy.example.com:1080
```

## Error Handling and Retry Logic

The crawler automatically handles proxy failures:

1. **Network Errors**: Connection timeouts, DNS failures, etc.
2. **Proxy Errors**: Authentication failures, proxy server errors
3. **HTTP Errors**: 403, 429, 503 status codes

When a proxy fails:
1. The proxy is marked as failed and temporarily blacklisted
2. The request is retried with a different proxy
3. After the blacklist duration expires, the proxy is retried

## Proxy Statistics

At the end of each crawl, you'll see detailed proxy statistics:

```
🌐 Proxy Statistics:
📊 Total proxies: 3
✅ Available proxies: 2
❌ Blacklisted proxies: 1

📋 Proxy Details:
  1. http://***:***@proxy1.example.com:8080
     Success: 45, Failed: 2, Rate: 95.74%
     Last used: 2024-01-15T10:30:00.000Z, Blacklisted: No
  2. http://proxy2.example.com:3128
     Success: 38, Failed: 1, Rate: 97.44%
     Last used: 2024-01-15T10:29:45.000Z, Blacklisted: No
  3. socks5://***:***@proxy3.example.com:1080
     Success: 0, Failed: 5, Rate: 0.00%
     Last used: Never, Blacklisted: Yes
```

## Best Practices

### 1. Use Multiple Proxies
Always provide multiple proxy URLs to ensure redundancy and load distribution.

### 2. Monitor Proxy Performance
Check the proxy statistics to identify poorly performing proxies and replace them.

### 3. Set Appropriate Timeouts
Configure proxy timeouts based on your network conditions and proxy quality.

### 4. Use Bypass URLs
Add localhost and internal URLs to the bypass list to avoid unnecessary proxy usage.

### 5. Rotate Proxies Appropriately
- Use `perRequest` for maximum anonymity
- Use `perPage` for balanced performance
- Use `perSession` for consistent sessions

## Troubleshooting

### Common Issues

1. **All Proxies Blacklisted**
   - Check proxy URLs for correctness
   - Verify proxy credentials
   - Increase `blacklistDuration` if proxies are temporarily unavailable

2. **High Failure Rates**
   - Check proxy quality and reliability
   - Increase `retryCount` for more attempts
   - Adjust `timeout` values

3. **Slow Performance**
   - Reduce `retryDelay` for faster retries
   - Use `perSession` rotation for better performance
   - Check proxy server performance

### Debug Mode

Enable debug logging by setting the crawler to non-headless mode:

```javascript
headless: false
```

This will show detailed proxy usage information in the browser console.

## Testing

Run the proxy configuration test:

```bash
node test-proxy-config.js
```

This will verify all proxy functionality is working correctly.

## Security Notes

- Never commit proxy credentials to version control
- Use environment variables for sensitive proxy information
- Regularly rotate proxy credentials
- Monitor proxy usage for unusual patterns

## Performance Impact

- Proxy usage adds ~100-500ms latency per request
- Multiple proxies provide better reliability but may increase complexity
- Use `perSession` rotation for best performance
- Monitor proxy statistics to optimize configuration
