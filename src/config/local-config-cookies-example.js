/**
 * Example configuration with cookies
 * Copy this file to local-config-override.js and modify as needed
 */

export const LOCAL_CONFIG_OVERRIDE = {
    // Example: Scraping ahrefs.com with authentication cookies
    siteName: 'Ahrefs',
    baseUrl: 'https://ahrefs.com/',
    startUrl: 'https://ahrefs.com/dashboard',
    allowedUrlPatterns: [
        'https://ahrefs.com/dashboard*',
        'https://ahrefs.com/site-explorer*'
    ],
    
    // Enable scraper mode for specific URLs
    scraperMode: true,
    scraperUrls: [
        'https://ahrefs.com/dashboard',
        'https://ahrefs.com/site-explorer/overview/v2/exact/ahrefs.com'
    ],
    
    // Add your browser extension cookies here
    // These are the exact cookies you provided in your example
    cookies: [
        {
            "domain": ".ahrefs.com",
            "expirationDate": 1757322910.775961,
            "hostOnly": false,
            "httpOnly": true,
            "name": "session_token",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": true,
            "session": false,
            "storeId": "0",
            "value": "kHzmCrr9mtRpDCCEDa4oZA0t7XOhB8K4JvwYFlJ9ZYQ-1757321110-1.0.1.1-.fCajaBZ1MUCl3DhSBbsPAmfwIuYRZFV.H1cyd_ZKVejFIk6nVkw28VLD45bQp3FNRFdvAM22LIP9PFdyoKmHaLzUr50yTuwDZvXNAqIBJk"
        },
        {
            "domain": ".ahrefs.com",
            "expirationDate": 1759913811.713249,
            "hostOnly": false,
            "httpOnly": true,
            "name": "BSSESSID",
            "path": "/",
            "sameSite": "lax",
            "secure": true,
            "session": false,
            "storeId": "0",
            "value": "vW5imNQD4n7UyVQyaud5TaSmszhCdnToY%2BOEsaWS"
        },
        {
            "domain": ".ahrefs.com",
            "expirationDate": 1757926614,
            "hostOnly": false,
            "httpOnly": false,
            "name": "intercom-session-dic5omcp",
            "path": "/",
            "sameSite": "lax",
            "secure": false,
            "session": false,
            "storeId": "0",
            "value": "dldBem80bCs1dmR3dmRGbWFYekN3N3R1enJrZGhiSENDOGRncm1lVHhnMXREY05LdkFUVTd5Zmh4dmZMK3pVc3BHVG85ZnF1VVhBaERPUWhUcTBUdVVDOVN0dzJPMkFNaTVuRFczV0hrSU09LS1CdmUrdkhnL1luT3d4ZGVLaXgxOVRBPT0=--fb3f0447eac4298a6e13a4e6120ea6898549cd6d"
        }
    ],
    
    // Other settings
    headless: false, // Set to false to see the browser in action
    manualMode: true, // Enable manual intervention if needed
    outputFilename: 'ahrefs-scraped-data'
};
