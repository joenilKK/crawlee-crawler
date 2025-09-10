/**
 * Local development configuration
 * This file is used when running the crawler locally for testing
 */

export const LOCAL_CONFIG = {
    // Site configuration - modify these for your target site
    siteName: 'MT Alvernia',
    baseUrl: 'https://mtalvernia.sg/',
    startUrl: 'https://mtalvernia.sg/doctors/',
    allowedUrlPatterns: [
      'https://mtalvernia.sg/doctors/',
      'https://mtalvernia.sg/doctors/*'
    ],
    excludedUrlPatterns: [],
    
    // Pagination settings
    paginationType: 'path', // 'query' or 'path'
    queryPattern: '', // for query pagination
    pathPattern: '/principal/{page}/', // for path pagination
    paginationBaseUrl: null, // uses startUrl if null
    startPage: 1,
    
    // Selectors
    specialistLinksSelector: '.list-group.list-group-flush a',
    nextButtonSelector: '.container > div > .col-12.col-md-6 > nav > ul.pagination > li:nth-last-child(2) > a',
    nextButtonContainerSelector: '.container > div > .col-12.col-md-6 > nav > ul.pagination',
    doctorNameSelector: 'h1.card-title.align-self-start.mb-0.dlbg-L.dlbg-LS',
    contactLinksSelector: '.mp-pac .mp-pac-box a.moe-vp-pac',
    
    // Crawler settings
    maxRequestsPerCrawl: 3, // Lower for local testing
    headless: false, // Set to false for local debugging
    timeout: 60000, // Increased timeout for manual interaction
    manualMode: true, // Enable manual mode for handling challenges
    
    // Scraper-only mode settings
    scraperMode: true, // Set to true to enable scraper-only mode (no crawling/pagination)
    scraperUrls: [
        // Add specific URLs to scrape (when scraperMode is true)
        // 'https://example.com/page1',
        'https://mtalvernia.sg/doctors/'
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
        // Example for ahrefs.com cookies:
        /*
        {"domain":".ahrefs.com","expirationDate":1757322910.775961,"hostOnly":false,"httpOnly":true,"name":"__cf_bm","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"kHzmCrr9mtRpDCCEDa4oZA0t7XOhB8K4JvwYFlJ9ZYQ-1757321110-1.0.1.1-.fCajaBZ1MUCl3DhSBbsPAmfwIuYRZFV.H1cyd_ZKVejFIk6nVkw28VLD45bQp3FNRFdvAM22LIP9PFdyoKmHaLzUr50yTuwDZvXNAqIBJk"},
        {"domain":".ahrefs.com","expirationDate":1759913811.713249,"hostOnly":false,"httpOnly":true,"name":"BSSESSID","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"vW5imNQD4n7UyVQyaud5TaSmszhCdnToY%2BOEsaWS"},
        {"domain":".ahrefs.com","expirationDate":1757926614,"hostOnly":false,"httpOnly":false,"name":"intercom-session-dic5omcp","path":"/","sameSite":"lax","secure":false,"session":false,"storeId":"0","value":"dldBem80bCs1dmR3dmRGbWFYekN3N3R1enJrZGhiSENDOGRncm1lVHhnMXREY05LdkFUVTd5Zmh4dmZMK3pVc3BHVG85ZnF1VVhBaERPUWhUcTBUdVVDOVN0dzJPMkFNaTVuRFczV0hrSU09LS1CdmUrdkhnL1luT3d4ZGVLaXgxOVRBPT0=--fb3f0447eac4298a6e13a4e6120ea6898549cd6d"}
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
