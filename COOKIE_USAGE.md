# 🍪 Cookie Usage Guide

This guide explains how to use JSON cookies from browser extensions with your Crawlee crawler.

## Overview

The crawler now supports importing cookies from browser extensions (like EditThisCookie, Cookie-Editor, etc.) to maintain authentication sessions while crawling.

## How to Add Cookies

### Method 1: Direct Configuration (Local Development)

1. **Export cookies from your browser extension** in JSON format
2. **Add cookies to your local configuration:**

```javascript
// In src/config/local-config.js or local-config-override.js
export const LOCAL_CONFIG = {
    // ... other configuration
    
    cookies: [
        {
            "domain": ".example.com",
            "expirationDate": 1757322910.775961,
            "hostOnly": false,
            "httpOnly": true,
            "name": "session_cookie",
            "path": "/",
            "sameSite": "lax",
            "secure": true,
            "session": false,
            "storeId": "0",
            "value": "your_cookie_value_here"
        }
        // Add more cookies as needed
    ]
};
```

### Method 2: Using Override File (Recommended)

1. **Create a local override file:**
   ```bash
   cp src/config/local-config-cookies-example.js src/config/local-config-override.js
   ```

2. **Edit the override file** with your specific cookies and configuration

3. **The override will be automatically applied** when you run the crawler

### Method 3: Apify Environment

When running in Apify, add the `cookies` field to your Actor input JSON:

```json
{
    "siteName": "Your Site",
    "baseUrl": "https://example.com",
    "cookies": [
        {
            "domain": ".example.com",
            "name": "session_cookie",
            "value": "your_cookie_value",
            "path": "/",
            "secure": true,
            "httpOnly": true,
            "sameSite": "lax"
        }
    ]
}
```

## Cookie Format

The crawler accepts cookies in the standard browser extension format:

```javascript
{
    "domain": ".example.com",           // Cookie domain (with dot for subdomains)
    "expirationDate": 1757322910.775,  // Unix timestamp (optional)
    "hostOnly": false,                 // Whether cookie is host-only
    "httpOnly": true,                  // Whether cookie is HTTP-only
    "name": "cookie_name",             // Cookie name
    "path": "/",                       // Cookie path
    "sameSite": "lax",                 // SameSite policy: "lax", "strict", or "no_restriction"
    "secure": true,                    // Whether cookie requires HTTPS
    "session": false,                  // Whether cookie is session-only
    "storeId": "0",                    // Browser store ID (ignored)
    "value": "cookie_value"            // Cookie value
}
```

## Browser Extension Export Instructions

### EditThisCookie (Chrome)
1. Visit the website where you're logged in
2. Click the EditThisCookie extension icon
3. Click the export icon (📤)
4. Select "JSON" format
5. Copy the JSON array

### Cookie-Editor (Chrome/Firefox)
1. Visit the website where you're logged in
2. Click the Cookie-Editor extension icon
3. Click "Export" → "JSON"
4. Copy the JSON array

### Developer Tools (Manual)
1. Open Developer Tools (F12)
2. Go to Application/Storage tab
3. Navigate to Cookies → your domain
4. Manually copy cookie values into the format above

## Example Usage

Here's a complete example for scraping an authenticated site:

```javascript
// local-config-override.js
export const LOCAL_CONFIG_OVERRIDE = {
    siteName: 'Protected Site',
    baseUrl: 'https://protected-site.com/',
    startUrl: 'https://protected-site.com/dashboard',
    
    scraperMode: true,
    scraperUrls: [
        'https://protected-site.com/dashboard',
        'https://protected-site.com/profile'
    ],
    
    cookies: [
        {
            "domain": ".protected-site.com",
            "name": "auth_token",
            "value": "your_auth_token_here",
            "path": "/",
            "secure": true,
            "httpOnly": true,
            "sameSite": "lax"
        },
        {
            "domain": ".protected-site.com",
            "name": "session_id",
            "value": "your_session_id_here",
            "path": "/",
            "secure": true,
            "httpOnly": false,
            "sameSite": "lax"
        }
    ],
    
    headless: false, // See browser for debugging
    manualMode: true // Enable manual intervention if needed
};
```

## Troubleshooting

### Cookies Not Working
1. **Check cookie domains** - Make sure they match the target website
2. **Verify cookie expiration** - Expired cookies won't work
3. **Check secure flag** - HTTPS sites require secure cookies
4. **Review sameSite policy** - Some sites are strict about this

### Authentication Issues
1. **Export fresh cookies** - Re-login and export new cookies
2. **Include all necessary cookies** - Some sites need multiple cookies
3. **Check for CSRF tokens** - Some sites require additional headers

### Console Output
The crawler will show cookie information in the console:
```
🍪 Loading 3 cookies for the session
Cookie domains: .example.com, .api.example.com
🍪 Applied 3 cookies to page context
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit cookies to version control** - Add `local-config-override.js` to `.gitignore`
2. **Cookies contain sensitive data** - Treat them like passwords
3. **Rotate cookies regularly** - Export fresh cookies periodically
4. **Use environment variables** for production deployments

## Support

If you encounter issues with cookie functionality:

1. Check the console output for cookie-related messages
2. Verify your cookie format matches the expected structure
3. Test with a simple site first before complex authentication flows
4. Enable `headless: false` and `manualMode: true` for debugging
