/**
 * Configuration settings for the Camden Medical Centre crawler
 * This configuration is synced with local-config.js for Apify actor deployment
 */

export const CONFIG = {
    // Site configuration - synced with local-config.js
    SITE: {
        name: 'Camden Medical Centre',
        baseUrl: 'https://www.camden.com.sg//',
        startUrl: 'https://www.camden.com.sg/find-a-doctor?type=doctor&sid=all&search=&page=1',
        allowedUrlPatterns: [
            'https://www.camden.com.sg/find-a-doctor?type=doctor&sid=all&search=&page=*',
            'https://www.camden.com.sg/specialist/*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [
            'https://www.camden.com.sg/corporate/about/'
        ],
        // Pagination configuration
        pagination: {
            type: 'query',
            queryPattern: 'page={page}',
            pathPattern: '',
            baseUrl: null, // Uses startUrl by default
            startPage: 1
        }
    },

    // Selectors for web scraping - synced with local-config.js
    SELECTORS: {
        // Specialist listing page selectors
        specialistLinks: '.profilepic a.profileurl',
        nextButton: '.list-paginationcontainer .list-pagenext',
        nextButtonContainer: '.list-paginationcontainer',
        
        // Specialist detail page selectors
        doctorName: 'h1.masthead-title',
        specialty: '.doc-personalinfo .col .grid-box a',
        contactLinks: '.clinic-contacts a',
        tableRows: '.clinic-contacts .grid a'
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: 200, // Use -1 for unlimited crawling - will be overridden by actor input
        headless: true, // Set to true for production
        timeout: 10000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
    },

    // File output settings
    OUTPUT: {
        getFilename: () => {
            const today = new Date().toISOString().split('T')[0];
            return `camden-scraped-data-${today}.json`;
        }
    },

    // Cookies configuration (empty by default, can be added via input)
    COOKIES: []
};
