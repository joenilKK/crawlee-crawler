/**
 * Local development configuration
 * This file is used when running the crawler locally for testing
 */

export const LOCAL_CONFIG = {
    // Site configuration - modify these for your target site
    siteName: 'MT Alvernia',
    baseUrl: 'https://www.memc.com.sg/',
    startUrl: 'https://www.memc.com.sg/specialist/',
    allowedUrlPatterns: [
      'https://www.memc.com.sg/specialist/',
      'https://www.memc.com.sg/specialist/*'
    ],
    excludedUrlPatterns: [
      'https://www.memc.com.sg/specialist/about/',
    ],
    
    // Pagination settings
    paginationType: 'path', // 'query' or 'path'
    queryPattern: '', // for query pagination
    pathPattern: '/page/{page}/', // for path pagination
    paginationBaseUrl: null, // uses startUrl if null
    startPage: 1,
    
    // Selectors
    specialistLinksSelector: '.specialist-list a.thumbnail',
    nextButtonSelector: '.pagination .pagination-next a',
    specialty: '.desktop h2.speciality a',
    nextButtonContainerSelector: '.paginationt',
    doctorNameSelector: '.desktop > h1',
    contactLinksSelector: '.left-sidebar ul li a',
    
    // Crawler settings
    maxRequestsPerCrawl: 5, // Lower for local testing
    headless: false, // Set to false for local debugging
    timeout: 10000, // Request timeout in milliseconds
    
    // Scraper-only mode settings
    scraperMode: false, // Set to true to enable scraper-only mode (no crawling/pagination)
    scraperUrls: [
        // Add specific URLs to scrape (when scraperMode is true)
        // 'https://example.com/page1',
        // 'https://mtalvernia.sg/doctors/'
    ],
    
    // Custom data extraction selectors (for scraper mode)
    customSelectors: {
        // Define selectors for doctor cards/containers
        doctorCards: '.doctor-card, .doctor-item, .profile-card, .specialist-card, .card',
        doctorName: '.doctor-name, .name, h3, h4, .title',
        position: '.specialty, .position, .department, p, .description',
        phoneLinks: '.tel_number a, a[href^="tel:"], .phone a, .contact a',
        // You can add more custom selectors as needed
    },
    
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
