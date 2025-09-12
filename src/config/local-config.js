/**
 * Local development configuration
 * This file is used when running the crawler locally for testing
 */

export const LOCAL_CONFIG = {
    // Site configuration - modify these for your target site
    siteName: 'Farrer Park Hospital',
    baseUrl: 'https://www.farrerpark.com/',
    startUrl: 'https://www.farrerpark.com/patients-and-visitors/doctor.html',
    allowedUrlPatterns: [
      'https://www.farrerpark.com/patients-and-visitors/doctor/detail.html?id=*',
      'https://www.farrerpark.com/patients-and-visitors/doctor/detail.html?id=*',
    ],
    excludedUrlPatterns: [],
    
    // Pagination settings - AJAX pagination (URL doesn't change)
    paginationType: 'ajax', // 'query', 'path', or 'ajax'
    queryPattern: 'page={page}', // for query pagination
    pathPattern: '', // for path pagination
    paginationBaseUrl: null, // uses startUrl if null
    startPage: 1,
    
    // Selectors for Farrer Park
    specialistLinksSelector: '.list-doctor .list-doctor__view a',
    nextButtonSelector: '.pagination-next #nextBtn',
    nextButtonContainerSelector: '.pagination-next',
    processingIndicatorSelector: 'body.processing',
    doctorNameSelector: '.doctor-banner .doctor-profile h1',
    specialtySelector: '.doctor-profile__item:first-child .doctor-profile__item-detail',
    contactLinksSelector: '.clinic-item a',
    tableRowsSelector: '.doctor-info table tr, .profile-details table tr',
    
    // Crawler settings
    maxRequestsPerCrawl: 5, // Lower for local testing, use -1 for unlimited crawling
    headless: false, // Set to false for local debugging
    timeout: 10000, // Request timeout in milliseconds (further reduced from 15s to 10s)
    delayBetweenLinks: 100, // Delay in milliseconds between processing each doctor link (further reduced from 200ms)
    delayBeforeNavigation: 100, // Delay before navigating to each doctor page (further reduced from 200ms)
    delayAfterPageLoad: 200, // Delay after page loads to ensure stability (further reduced from 500ms)
    ajaxPaginationDelay: 500, // Extra delay for AJAX pagination (further reduced from 1000ms)
    
    
    // Output settings
    outputFilename: 'mtalvernia-scraped-data', // Custom filename (will add .json automatically)
    
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
