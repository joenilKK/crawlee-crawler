/**
 * Local development configuration
 * This file is used when running the crawler locally for testing
 */

export const LOCAL_CONFIG = {
    // Site configuration - modify these for your target site
    siteName: 'Novena Medical Centre',
    baseUrl: 'https://novenamedicalcenter.com/',
    startUrl: 'https://novenamedicalcenter.com/our-doctors/',
    allowedUrlPatterns: [
      'https://novenamedicalcenter.com/our-doctors/*',
    ],
    excludedUrlPatterns: [
      'https://novenamedicalcenter.com/about/',
    ],
    
    // Pagination settings
    paginationType: 'query', // 'query' or 'path'
    queryPattern: 'page={page}', // for query pagination
    pathPattern: '', // for path pagination
    paginationBaseUrl: null, // uses startUrl if null
    startPage: 1,
    
    // Selectors
    specialistLinksSelector: '.searchresults tbody tr td a',
    nextButtonSelector: '.list-paginationcontainer .list-pagenext',
    nextButtonContainerSelector: '.list-paginationcontainer',
    doctorNameSelector: '.doctors h2',
    specialtySelector: '.speciality ul li',
    linksSelector: '.clinicdetailstable tbody tr td a', //this can be multiple links
    //  tableRowsSelector: '.clinic-contacts .grid a',
    
    // Crawler settings
    maxRequestsPerCrawl: 4, // Lower for local testing, use -1 for unlimited crawling
    headless: false, // Set to false for local debugging
    timeout: 10000, // Request timeout in milliseconds
    
    
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
