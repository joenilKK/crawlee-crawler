import { PlaywrightCrawler } from 'crawlee';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination, handleAjaxPagination } from './handlers/paginationHandler.js';
import { shouldCrawlUrl } from './utils/helpers.js';
import { 
    getConfiguration, 
    handleDataOutput, 
    handleExit 
} from './config/environment.js';

/**
 * Convert browser extension cookies to Playwright format
 * @param {Array} cookies - Array of cookies from browser extension
 * @returns {Array} Playwright-formatted cookies
 */
function convertCookiesToPlaywrightFormat(cookies) {
    if (!cookies || !Array.isArray(cookies)) {
        return [];
    }
    
    return cookies.map(cookie => {
        const playwrightCookie = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false
        };
        
        // Handle expiration date
        if (cookie.expirationDate) {
            // Convert from Unix timestamp to Date
            playwrightCookie.expires = Math.floor(cookie.expirationDate);
        }
        
        // Handle sameSite attribute
        if (cookie.sameSite) {
            const sameSiteMap = {
                'no_restriction': 'None',
                'lax': 'Lax',
                'strict': 'Strict'
            };
            playwrightCookie.sameSite = sameSiteMap[cookie.sameSite] || 'Lax';
        }
        
        return playwrightCookie;
    });
}

// Get configuration based on environment (Apify or local)
const { input, isApify, Actor } = await getConfiguration();

// No input validation needed - all settings come from local config

// Import local configuration for hardcoded values
const { LOCAL_CONFIG } = await import('./config/local-config.js');

// Create configuration object using local config with input overrides
const CONFIG = {
    SITE: {
        name: LOCAL_CONFIG.siteName,
        baseUrl: LOCAL_CONFIG.baseUrl,
        startUrl: LOCAL_CONFIG.startUrl,
        allowedUrlPatterns: LOCAL_CONFIG.allowedUrlPatterns,
        excludedUrlPatterns: LOCAL_CONFIG.excludedUrlPatterns || [],
        pagination: {
            type: LOCAL_CONFIG.paginationType,
            queryPattern: LOCAL_CONFIG.queryPattern || 'page={page}',
            pathPattern: LOCAL_CONFIG.pathPattern || '/page/{page}/',
            baseUrl: LOCAL_CONFIG.paginationBaseUrl || null,
            startPage: LOCAL_CONFIG.startPage || 1
        }
    },
    SELECTORS: {
        specialistLinks: LOCAL_CONFIG.specialistLinksSelector,
        nextButton: LOCAL_CONFIG.nextButtonSelector,
        nextButtonContainer: LOCAL_CONFIG.nextButtonContainerSelector,
        processingIndicator: LOCAL_CONFIG.processingIndicatorSelector,
        doctorName: LOCAL_CONFIG.doctorNameSelector,
        specialty: LOCAL_CONFIG.specialtySelector,
        contactLinks: LOCAL_CONFIG.contactLinksSelector,
        tableRows: LOCAL_CONFIG.tableRowsSelector || '.panel-body tbody tr'
    },
    CRAWLER: {
        maxRequestsPerCrawl: LOCAL_CONFIG.maxRequestsPerCrawl,
        headless: LOCAL_CONFIG.headless,
        timeout: LOCAL_CONFIG.timeout,
        userAgent: LOCAL_CONFIG.userAgent,
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
    },
    OUTPUT: {
        getFilename: () => {
            // Use input filename if provided, otherwise use local config, otherwise use default
            const customFilename = input.outputFilename && input.outputFilename.trim() !== '' ? 
                input.outputFilename : 
                (LOCAL_CONFIG.outputFilename && LOCAL_CONFIG.outputFilename.trim() !== '' ? 
                    LOCAL_CONFIG.outputFilename : null);
                    
            if (customFilename) {
                return customFilename.endsWith('.json') ? customFilename : `${customFilename}.json`;
            }
            
            const today = new Date().toISOString().split('T')[0];
            return `opengovsg-scraped-data-${today}.json`;
        }
    },
    COOKIES: LOCAL_CONFIG.cookies || [],
};

console.log('Starting crawler with configuration:', {
    environment: isApify ? 'Apify' : 'Local',
    siteName: CONFIG.SITE.name,
    startUrl: CONFIG.SITE.startUrl,
    maxRequests: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? 'unlimited' : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless
});

// Array to store all extracted data
let extractedData = [];

// Create backup of existing file if needed
createBackupIfExists(CONFIG.OUTPUT.getFilename(), CONFIG);

// Convert cookies to Playwright format
const playwrightCookies = convertCookiesToPlaywrightFormat(CONFIG.COOKIES);

console.log(`🍪 Loading ${playwrightCookies.length} cookies for the session`);
if (playwrightCookies.length > 0) {
    console.log('Cookie domains:', [...new Set(playwrightCookies.map(c => c.domain))].join(', '));
}

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: CONFIG.CRAWLER.headless,
            ignoreHTTPSErrors: true
        }
    },
    // Set lower concurrency to be respectful
    maxConcurrency: 1,
    // Set user agent
    browserPoolOptions: {
        useFingerprints: false,
        preLaunchHooks: [
            async (pageId, launchContext) => {
                launchContext.launchOptions.args = [
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-background-sync',
                    '--disable-device-discovery-notifications',
                    '--disable-hang-monitor',
                    '--disable-component-update',
                    `--user-agent=${CONFIG.CRAWLER.userAgent}`
                ];
            }
        ]
    },
    // Handle session pool configuration
    sessionPoolOptions: {
        blockedStatusCodes: [], // Don't auto-block any status codes (including 403, 503)
        maxPoolSize: 1,
        sessionOptions: {
            maxErrorScore: 10, // Higher tolerance for "errors" 
            errorScoreDecrement: 0.5, // Slower error recovery
        }
    },
    // Add delays between requests to avoid being detected as a bot
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 30,
    // Add random delays between requests
    minConcurrency: 1,
    maxConcurrency: 1,
    // Handle failed requests
    failedRequestHandler: async ({ request, error }) => {
        console.error(`❌ Request failed: ${error.message}`);
    },
    requestHandler: async ({ page, request, enqueueLinks }) => {
        // Add random delay between 2-5 seconds to mimic human behavior
        const delay = Math.random() * 3000 + 2000;
        console.log(`⏱️ Waiting ${Math.round(delay)}ms before processing request`);
        await page.waitForTimeout(delay);
        console.log(`Processing: ${request.url}`);
        
        // This is the main entry point - start sequential processing
        console.log('Starting sequential corporate entity extraction');
        console.log(`Looking for selector: ${CONFIG.SELECTORS.specialistLinks}`);
        
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages) {
            console.log(`Processing page ${currentPage}...`);
            
            try {
                // Wait for the entity links to load
                await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                console.log(`✅ Entity links found on page ${currentPage}!`);
                
                // Get all entity links on current page
                const entityLinks = await page.evaluate((selector) => {
                    const links = document.querySelectorAll(selector);
                    return Array.from(links).map(link => link.href).filter(href => href);
                }, CONFIG.SELECTORS.specialistLinks);
                
                console.log(`Found ${entityLinks.length} entities on page ${currentPage}`);
                
                // Process each entity immediately before moving to next page
                for (let i = 0; i < entityLinks.length; i++) {
                    const entityUrl = entityLinks[i];
                    console.log(`Processing entity ${i + 1}/${entityLinks.length} on page ${currentPage}: ${entityUrl}`);
                    
                    try {
                        // Navigate to entity page
                        await page.goto(entityUrl, { waitUntil: 'networkidle' });
                        
                        // Extract data from this entity page
                        const entityData = await extractSpecialistData(page, entityUrl, CONFIG);
                        
                        // Add to extracted data array
                        extractedData.push(entityData);
                        
                        // Save data after each extraction (incremental save)
                        await saveDataToFile(extractedData, CONFIG);
                        
                        console.log(`✅ Completed entity ${i + 1}/${entityLinks.length}: ${entityData.doctorname || entityData.url}`);
                        
                        // Small delay between entities
                        await page.waitForTimeout(1000);
                        
                    } catch (error) {
                        console.error(`❌ Error processing entity ${entityUrl}:`, error);
                        
                        // Add error entry to data
                        extractedData.push({
                            url: entityUrl,
                            doctorname: 'Processing failed',
                            specialty: '',
                            contact: [],
                            businessOverview: [],
                            error: error.message,
                            extractedAt: new Date().toISOString()
                        });
                    }
                }
                
                console.log(`✅ Completed all ${entityLinks.length} entities on page ${currentPage}`);
                
                // Return to listing page for next page navigation
                const listingUrl = CONFIG.SITE.pagination.type === 'query' ? 
                    `${CONFIG.SITE.startUrl}&page=${currentPage + 1}` : 
                    CONFIG.SITE.startUrl;
                
                // Check if there's a next page by trying to navigate to it
                try {
                    await page.goto(listingUrl, { waitUntil: 'networkidle' });
                    
                    // Check if the next page has entities
                    const nextPageEntityLinks = await page.evaluate((selector) => {
                        const links = document.querySelectorAll(selector);
                        return Array.from(links).length;
                    }, CONFIG.SELECTORS.specialistLinks);
                    
                    if (nextPageEntityLinks > 0) {
                        currentPage++;
                        console.log(`Moving to page ${currentPage} - found ${nextPageEntityLinks} entities`);
                    } else {
                        console.log(`No more entities found - reached end of results`);
                        hasMorePages = false;
                    }
                    
                } catch (error) {
                    console.log(`No more pages available or error navigating to next page:`, error.message);
                    hasMorePages = false;
                }
                
            } catch (error) {
                console.log(`❌ Error on page ${currentPage}:`, error.message);
                hasMorePages = false;
            }
        }
        
        console.log(`Completed processing all pages. Total pages processed: ${currentPage}`);
    },
    maxRequestsPerCrawl: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? undefined : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
});

await crawler.run([CONFIG.SITE.startUrl]);

// Save extracted data to JSON file
const outputPath = await saveDataToFile(extractedData, CONFIG, CONFIG.COOKIES);

// Handle data output based on environment
await handleDataOutput(extractedData, CONFIG, Actor, isApify, CONFIG.COOKIES);

console.log(`✅ Crawling completed! Found ${extractedData.length} entities.`);
console.log(`📁 Data saved to: ${outputPath}`);

// Handle exit based on environment
await handleExit(Actor, isApify);
