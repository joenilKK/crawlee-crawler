/**
 * Configuration settings for the MT Alvernia crawler
 */

export const CONFIG = {
    // Site configuration
    SITE: {
        name: 'MT Alvernia',
        baseUrl: 'https://mtalvernia.sg/',
        startUrl: 'https://mtalvernia.sg/doctors/',
        allowedUrlPatterns: [
            'https://mtalvernia.sg/doctors/',
            'https://mtalvernia.sg/doctors/*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [],
        // Pagination configuration
        pagination: {
            // Type of pagination: 'query' (e.g., ?page=2) or 'path' (e.g., /page/2/)
            type: 'path',
            queryPattern: '', // for query pagination
            pathPattern: '/principal/{page}/', // for path pagination
            // Base URL for pagination (if different from startUrl)
            baseUrl: null, // Uses startUrl by default
            // Starting page number (usually 1)
            startPage: 1
        }
    },

    // Selectors for web scraping
    SELECTORS: {
        // Specialist listing page selectors
        specialistLinks: '.list-group.list-group-flush a',
        nextButton: '.container > div > .col-12.col-md-6 > nav > ul.pagination > li:nth-last-child(2) > a',
        nextButtonContainer: '.container > div > .col-12.col-md-6 > nav > ul.pagination',
        
        // Specialist detail page selectors
        doctorName: 'h1.card-title.align-self-start.mb-0.dlbg-L.dlbg-LS',
        contactLinks: '.mp-pac .mp-pac-box a.moe-vp-pac'
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: 3, // Lower for local testing
        headless: false, // Set to false for local debugging
        timeout: 60000, // Increased timeout for manual interaction
        manualMode: true, // Enable manual mode for handling challenges
        scraperMode: true, // Set to true to enable scraper-only mode (no crawling/pagination)
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
    },

    // Scraper-only mode settings
    SCRAPER: {
        urls: [
            // Add specific URLs to scrape (when scraperMode is true)
            // 'https://example.com/page1',
            'https://mtalvernia.sg/doctors/'
        ],
        
        // Custom data extraction selectors (for scraper mode)
        customSelectors: {
            // Define selectors for doctor cards/containers
            doctorCards: '.doctor',
            doctorName: 'h4.doctor-name, .left h4',
            position: '.right > p',
            phoneLinks: '.tel_number a',
            Website: '.right p a',
            // You can add more custom selectors as needed
        }
    },

    // File output settings
    OUTPUT: {
        getFilename: () => {
            return 'mtalvernia-scraped-data.json';
        }
    },

    // User agent
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};