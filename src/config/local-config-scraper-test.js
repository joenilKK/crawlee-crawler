/**
 * Test configuration for scraper-only mode
 * Copy this content to local-config-override.js to test the scraper functionality
 */

export const LOCAL_CONFIG_OVERRIDE = {
    // Enable scraper-only mode
    scraperMode: true,
    manualMode: false, // Disable manual mode when using scraper mode
    
    // URLs to scrape - replace with your target websites
    scraperUrls: [
        'https://example.com',
        'https://httpbin.org/html',
        // Add more URLs here
    ],
    
    // Custom selectors for data extraction
    customSelectors: {
        // Page content
        title: 'h1, .title, .heading, title',
        description: 'p, .description, .content, .summary',
        
        // Links and navigation
        links: 'a[href]',
        navigation: 'nav a, .nav a, .menu a',
        
        // Images
        images: 'img[src]',
        
        // Contact information
        email: 'a[href^="mailto:"], .email',
        phone: 'a[href^="tel:"], .phone',
        
        // Content areas
        content: '.content, main, article, .main-content',
        
        // Common elements
        headings: 'h1, h2, h3, h4, h5, h6',
        paragraphs: 'p',
    },
    
    // Scraper settings
    headless: false, // Set to true for headless mode
    timeout: 30000,
    maxRequestsPerCrawl: 10,
    
    // Output settings
    outputFilename: 'scraper-test-results',
    
    // Required fields (not used in scraper mode but needed for validation)
    siteName: 'Scraper Test',
    baseUrl: 'https://example.com',
    startUrl: 'https://example.com',
    allowedUrlPatterns: ['*'],
    paginationType: 'query',
    specialistLinksSelector: 'a',
    nextButtonSelector: '.next',
    nextButtonContainerSelector: '.pagination',
    doctorNameSelector: 'h1',
    contactLinksSelector: 'a',
};
