/**
 * Configuration settings for the Novena Medical Centre crawler
 * This configuration is synced with local-config.js for Apify actor deployment
 */

export const CONFIG = {
    // Site configuration - synced with local-config.js
    SITE: {
        name: 'Novena Medical Centre',
        baseUrl: 'https://novenamedicalcenter.com/',
        startUrl: 'https://novenamedicalcenter.com/our-doctors/',
        allowedUrlPatterns: [
            'https://novenamedicalcenter.com/our-doctors/*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [
            'https://novenamedicalcenter.com/about/'
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
        specialistLinks: '.searchresults tbody tr td a',
        nextButton: '.list-paginationcontainer .list-pagenext',
        nextButtonContainer: '.list-paginationcontainer',
        
        // Specialist detail page selectors
        doctorName: '.doctors h2',
        specialty: '.speciality ul li',
        contactLinks: '.clinicdetailstable tbody tr td a',
        tableRows: '.panel-body tbody tr' // Default fallback selector
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: 4, // Use -1 for unlimited crawling - will be overridden by actor input
        headless: false, // Set to false for local debugging, true for production
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
            // Use custom filename from local config if available
            const customFilename = 'mtalvernia-scraped-data';
            if (customFilename && customFilename.trim() !== '') {
                return customFilename.endsWith('.json') ? customFilename : `${customFilename}.json`;
            }
            
            const today = new Date().toISOString().split('T')[0];
            return `novena-scraped-data-${today}.json`;
        }
    },

    // Cookies configuration (empty by default, can be added via input)
    COOKIES: []
};
