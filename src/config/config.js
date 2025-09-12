/**
 * Configuration settings for the MT Alvernia crawler
 */

export const CONFIG = {
    // Site configuration
    SITE: {
        name: 'MT Alvernia',
        baseUrl: 'https://www.memc.com.sg/',
        startUrl: 'https://www.memc.com.sg/specialist/',
        allowedUrlPatterns: [
            'https://www.memc.com.sg/specialist/',
            'https://www.memc.com.sg/specialist/*'
        ],
        // Patterns to exclude (optional)
        excludedUrlPatterns: [
            'https://www.memc.com.sg/specialist/about/',
        ],
        // Pagination configuration
        pagination: {
            type: 'path', // 'query' or 'path'
            queryPattern: '', // for query pagination
            pathPattern: '/page/{page}/', // for path pagination
            baseUrl: null, // uses startUrl if null
            startPage: 1
        }
    },

    // Selectors for web scraping
    SELECTORS: {
        // Specialist listing page selectors
        specialistLinks: '.specialist-list a.thumbnail',
        nextButton: '.pagination .pagination-next a',
        nextButtonContainer: '.paginationt',
        specialty: '.desktop h2.speciality a',
        
        // Specialist detail page selectors
        doctorName: '.desktop > h1',
        contactLinks: '.left-sidebar ul li a'
    },

    // Crawler settings
    CRAWLER: {
        maxRequestsPerCrawl: 1000, // Lower for local testing
        headless: false, // Set to false for local debugging
        timeout: 10000,
        scraperMode: false, // Set to true to enable scraper-only mode (no crawling/pagination)
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
            // 'https://mtalvernia.sg/doctors/'
        ],
        customSelectors: {
            // Define selectors for doctor cards/containers
            doctorCards: '.doctor-card, .doctor-item, .profile-card, .specialist-card, .card',
            doctorName: '.doctor-name, .name, h3, h4, .title',
            position: '.specialty, .position, .department, p, .description',
            phoneLinks: '.tel_number a, a[href^="tel:"], .phone a, .contact a',
            // You can add more custom selectors as needed
        }
    },

    // File output settings
    OUTPUT: {
        getFilename: () => {
            const today = new Date().toISOString().split('T')[0];
            return `mtalvernia-scraped-data-${today}.json`;
        }
    },

    // Cookies configuration
    COOKIES: [
        // Add your cookies here in the format:
        // {"domain":".example.com","expirationDate":1757322910.775961,"hostOnly":false,"httpOnly":true,"name":"cookie_name","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"cookie_value"}
        // Example cookies format:
        /*
        {"domain":".example.com","expirationDate":1757322910.775961,"hostOnly":false,"httpOnly":true,"name":"session_id","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"your_session_value_here"},
        {"domain":".example.com","expirationDate":1759913811.713249,"hostOnly":false,"httpOnly":true,"name":"auth_token","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"your_auth_token_here"}
        */
    ],

    // User agent
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};
