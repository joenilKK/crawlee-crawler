/**
 * Example configuration for scraper-only mode
 * Copy this configuration to your local-config-override.js to test scraper mode
 */

export const SCRAPER_EXAMPLE_CONFIG = {
    // Enable scraper-only mode
    scraperMode: true,
    
    // Disable other modes
    manualMode: false,
    
    // URLs to scrape (add your target websites here)
    scraperUrls: [
        'https://example.com',
        'https://httpbin.org/html',
        // Add more URLs as needed
    ],
    
    // Custom selectors for data extraction
    customSelectors: {
        // Basic content selectors
        title: 'h1, .title, .heading, title',
        description: 'p, .description, .content, .summary',
        
        // Navigation and links
        links: 'a[href]',
        navigation: 'nav a, .nav a, .menu a',
        
        // Images
        images: 'img[src]',
        
        // Contact information (common patterns)
        email: 'a[href^="mailto:"], .email, .contact-email',
        phone: 'a[href^="tel:"], .phone, .contact-phone',
        Website: '.website a, a[href*="http"], .url',
        
        // Social media
        social: 'a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]',
        
        // Content areas
        content: '.content, .main-content, main, article',
        sidebar: '.sidebar, .aside, aside',
        
        // Common website elements
        breadcrumbs: '.breadcrumb, .breadcrumbs',
        tags: '.tag, .tags, .category, .categories',
    },
    
    // Other settings
    headless: false, // Set to false to see browser during scraping
    timeout: 30000,
    maxRequestsPerCrawl: 10,
    
    // Output filename
    outputFilename: 'scraper-results',
    
    // Site info (used for output)
    siteName: 'Scraper Test',
    baseUrl: 'https://example.com',
    startUrl: 'https://example.com', // Not used in scraper mode, but required
};
