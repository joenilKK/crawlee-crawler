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
        // No maxRequestsPerCrawl - crawl all pages
        headless: true, // Set to true for production
        timeout: 30000, // Request timeout in milliseconds
        delayBetweenLinks: 3000, // Delay in milliseconds between processing each doctor link
        delayBeforeNavigation: 2000, // Delay before navigating to each doctor page
        delayAfterPageLoad: 5000, // Delay after page loads to ensure stability
        ajaxPaginationDelay: 6000, // Extra delay for AJAX pagination
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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

    // Cookies configuration (empty by default, can be added via input)
    COOKIES: []
};
