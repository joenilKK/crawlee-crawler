/**
 * Configuration settings for the Farrer Park Hospital crawler
 * This configuration is synced with local-config.js for Apify actor deployment
 */

export const CONFIG = {
    // Site configuration - synced with local-config.js
    SITE: {
        name: 'Farrer Park Hospital',
        baseUrl: 'https://www.farrerpark.com/',
        startUrl: 'https://www.farrerpark.com/patients-and-visitors/doctor.html',
        allowedUrlPatterns: [
            'https://www.farrerpark.com/patients-and-visitors/doctor/detail.html?id=*',
            'https://www.farrerpark.com/patients-and-visitors/doctor/detail.html?id=*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [],
        // Pagination configuration
        pagination: {
            type: 'ajax', // 'query', 'path', or 'ajax'
            queryPattern: 'page={page}',
            pathPattern: '',
            baseUrl: null, // Uses startUrl by default
            startPage: 1
        }
    },

    // Selectors for web scraping - synced with local-config.js
    SELECTORS: {
        // Specialist listing page selectors
        specialistLinks: '.list-doctor .list-doctor__view a',
        nextButton: '.pagination-next #nextBtn',
        nextButtonContainer: '.pagination-next',
        processingIndicator: 'body.processing',
        
        // Specialist detail page selectors
        doctorName: '.doctor-banner .doctor-profile h1',
        specialty: '.doctor-profile__item:first-child .doctor-profile__item-detail',
        contactLinks: '.clinic-item a',
        tableRows: '.doctor-info table tr, .profile-details table tr'
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: -1, // Lower for local testing, use -1 for unlimited crawling
        headless: true, // Set to false for local debugging
        timeout: 15000, // Request timeout in milliseconds (reduced from 30s to 15s)
        delayBetweenLinks: 200, // Delay in milliseconds between processing each doctor link (further reduced from 500ms)
        delayBeforeNavigation: 200, // Delay before navigating to each doctor page (further reduced from 500ms)
        delayAfterPageLoad: 500, // Delay after page loads to ensure stability (further reduced from 1000ms)
        ajaxPaginationDelay: 1000, // Extra delay for AJAX pagination (further reduced from 2000ms)
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        },
        // Anti-detection settings
        antiDetection: {
            enabled: true,
            randomizeUserAgent: true,
            randomizeViewport: true,
            randomizeTimezone: true,
            simulateHumanBehavior: true,
            useProxyRotation: false, // Set to true if you have proxies configured
            stealthMode: true,
            humanLikeDelays: true,
            mouseMovementSimulation: true,
            scrollSimulation: true
        }
    },

    // File output settings
    OUTPUT: {
        getFilename: () => {
            return 'mtalvernia-scraped-data.json';
        }
    },

    // Cookies configuration (empty by default, can be added via input)
    COOKIES: []
};
