/**
 * Configuration settings for the Mount Elizabeth crawler
 */

export const CONFIG = {
    // Site configuration
    SITE: {
        name: 'Mount Elizabeth Medical Centre',
        baseUrl: 'https://www.mountelizabeth.com.sg/',
        startUrl: 'https://www.mountelizabeth.com.sg/patient-services/specialists/',
        allowedUrlPatterns: [
            'https://www.mountelizabeth.com.sg/patient-services/specialists/',
            'https://www.mountelizabeth.com.sg/patient-services/specialists/*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [
            'https://www.mountelizabeth.com.sg/patient-services/specialty_areas/*',
            'https://www.mountelizabeth.com.sg/patient-services/health-screening/*',
            'https://www.mountelizabeth.com.sg/patient-services/about/*'
        ],
        // Pagination configuration
        pagination: {
            // Type of pagination: 'query' (e.g., ?page=2) or 'path' (e.g., /page/2/)
            // example for query
            //type: 'query',
            // queryPattern: 'page={page}',
            //==============================================
            // example for path
            //type: 'path',
            //pathPattern: '/page/{page}/',

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
        specialistLinks: '#gridcontent-desktop a.moe-fp-view-profile',
        nextButton: '.page-item.next a.page-link',
        nextButtonContainer: '.page-item.next',
        
        // Specialist detail page selectors
        doctorName: '.profile-text .profile-name',
        contactLinks: '.mp-pac .mp-pac-box a.moe-vp-pac'
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: 200, // Use -1 for unlimited crawling
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
            const today = new Date().toISOString().split('T')[0];
            return `memc-specialists-${today}.json`;
        }
    }
};
