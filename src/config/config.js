/**
 * Configuration settings for the OpenGovSG crawler
 */

export const CONFIG = {
    // Site configuration
    SITE: {
        name: 'OPENGOVSG',
        baseUrl: 'https://opengovsg.com/',
        startUrl: 'https://opengovsg.com/corporate?ssic=86201',
        allowedUrlPatterns: [
            'https://opengovsg.com/corporate/',
            'https://opengovsg.com/corporate/*',
            'https://opengovsg.com/corporate?*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [
            'https://opengovsg.com/corporate/about/',
        ],
        // Pagination configuration
        pagination: {
            type: 'query',
            queryPattern: 'page={page}',
            // Base URL for pagination (if different from startUrl)
            baseUrl: null, // Uses startUrl by default
            // Starting page number (usually 1)
            startPage: 1
        }
    },

    // Selectors for web scraping
    SELECTORS: {
        // Specialist listing page selectors
        specialistLinks: '.panel-card .panel-body table td a',
        nextButton: '.panel-footer ul.pager li a',
        nextButtonContainer: '.panel-footer ul.pager',
        
        // Specialist detail page selectors
        doctorName: '.panel-heading > h1',
        contactLinks: '.panel-body tbody tr td',
        tableRows: '.panel-body tbody tr'
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: -1, // Use -1 for unlimited crawling in Apify
        headless: true, // Set to true for production
        timeout: 10000,
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
    },

    // File output settings
    OUTPUT: {
        getFilename: () => {
            return 'mtalvernia-scraped-data.json';
        }
    },

    // User agents for rotation (expanded list for better diversity)
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0'
    ],

    // Proxy configuration for IP rotation
    PROXY: {
        enabled: false, // Set to true to enable proxy rotation
        rotationInterval: 10, // Rotate proxy every N requests
        countries: ['US', 'SG', 'GB', 'CA', 'AU'], // Preferred countries
        sessionPoolSize: 5 // Number of proxy sessions to maintain
    },

    // User agent for requests (legacy support)
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

    // Cookies configuration (empty by default, can be set via environment variables)
    COOKIES: []
};
