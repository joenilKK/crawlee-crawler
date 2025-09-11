/**
 * Example local configuration override
 * Copy this file to 'local-config-override.js' and modify as needed
 * This file will override settings in local-config.js
 */

export const LOCAL_CONFIG_OVERRIDE = {
    // Example: Test with a different site
    // siteName: 'Different Medical Center',
    // startUrl: 'https://example-medical-center.com/doctors/',
    
    // Example: Use different selectors
    // specialistLinksSelector: '.doctor-card a',
    // doctorNameSelector: '.doctor-name h1',
    
    // Example: Debugging settings
    // headless: false,
    // maxRequestsPerCrawl: 5, // Use -1 for unlimited crawling
    // timeout: 15000,
    
    // Example: Different pagination
    // paginationType: 'path',
    // pathPattern: '/doctors/page/{page}',
    
    // Example: Browser settings
    // userAgent: 'Custom User Agent',
    
    // Example: Custom output
    // outputFilename: 'my-custom-output.json'
    
    // Note: When running through Apify, only maxRequestsPerCrawl can be overridden
    // All other settings are taken from local-config.js
};
