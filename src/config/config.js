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

    // User agent for requests
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

    // Cookies configuration (empty by default, can be set via environment variables)
    COOKIES: []
};
