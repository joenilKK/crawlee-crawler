/**
 * Local development configuration
 * This file is used when running the crawler locally for testing
 */

export const LOCAL_CONFIG = {
    // Site configuration - modify these for your target site
    siteName: 'Open Gov SG Corporate Entities',
    baseUrl: 'https://opengovsg.com/',
    startUrl: 'https://opengovsg.com/corporate?ssic=86201',
    allowedUrlPatterns: [
      'https://opengovsg.com/corporate*',
      'https://opengovsg.com/corporate?ssic=86201&page=*'
    ],
    excludedUrlPatterns: [],
    
    // Pagination settings - Query-based pagination for OpenGovSG
    paginationType: 'query', // 'query', 'path', or 'ajax'
    queryPattern: 'page={page}', // for query pagination
    pathPattern: '', // for path pagination
    paginationBaseUrl: 'https://opengovsg.com/corporate?ssic=86201', // Direct base URL for pagination
    startPage: 1,
    maxPages: 11, // We know there are exactly 11 pages
    
    // Selectors for OpenGovSG Corporate Entities
    specialistLinksSelector: '.panel-card .panel-body .table tr > td > a',
    nextButtonSelector: '.panel-card .panel-footer .pager li:last-child a', // The actual next button
    nextButtonContainerSelector: '.panel-card .panel-footer .pager li',
    processingIndicatorSelector: 'body.processing', // Selector for AJAX loading indicator
    doctorNameSelector: '.panel-heading h1',
    specialtySelector: '', // Not needed for corporate entities
    contactLinksSelector: '', // Not needed for corporate entities  
    tableRowsSelector: '#overview.panel-card .panel-body .table tbody tr',
    
    // Crawler settings
    maxRequestsPerCrawl: -1, // Continue through ALL pages until pagination ends
    headless: true, // Set to true for production, false for debugging
    timeout: 100000, // Request timeout in milliseconds (increased for stability)
    maxRetries: 3, // Number of retry attempts for failed entity extractions
    browserRestartCount: 1, // Restart browser after EVERY page to completely eliminate persistence issues
    
    // Request intervals to prevent overwhelming the server (more conservative)
    requestInterval: 8000, // Wait 8 seconds between each entity request (in milliseconds)
    pageInterval: 15000, // Wait 15 seconds between page navigation (in milliseconds)  
    retryInterval: 20000, // Wait 20 seconds before retry attempts (in milliseconds)
    entityInterval: 5000, // Wait 5 seconds after each successful extraction (in milliseconds)
    
    
    // Output settings
    outputFilename: 'opengovsg-scraped-data', // Custom filename (will add .json automatically)
    
    // Cookies configuration
    cookies: [
        // Add your cookies here in the format:
        // {"domain":".example.com","expirationDate":1757322910.775961,"hostOnly":false,"httpOnly":true,"name":"cookie_name","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"cookie_value"}
        // Example cookies format:
        /*
        {"domain":".example.com","expirationDate":1757322910.775961,"hostOnly":false,"httpOnly":true,"name":"session_id","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"your_session_value_here"},
        {"domain":".example.com","expirationDate":1759913811.713249,"hostOnly":false,"httpOnly":true,"name":"auth_token","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"your_auth_token_here"}
        */
    ],
    
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

// You can override any of these settings by creating a local-config-override.js file
// that exports a LOCAL_CONFIG_OVERRIDE object with your custom values
try {
    const { LOCAL_CONFIG_OVERRIDE } = await import('./local-config-override.js');
    Object.assign(LOCAL_CONFIG, LOCAL_CONFIG_OVERRIDE);
    console.log('✅ Local configuration overrides applied');
} catch (error) {
    // Override file doesn't exist, which is fine
}
