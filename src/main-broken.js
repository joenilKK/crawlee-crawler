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

// Validate required input field
if (input.maxRequestsPerCrawl === undefined || input.maxRequestsPerCrawl === null || 
    (input.maxRequestsPerCrawl !== -1 && input.maxRequestsPerCrawl < 1)) {
    const errorMessage = `❌ CONFIGURATION ERROR: maxRequestsPerCrawl is required and must be a positive integer or -1 for unlimited crawling.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
}

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
        maxRequestsPerCrawl: input.maxRequestsPerCrawl,
        headless: input.headless !== undefined ? input.headless : LOCAL_CONFIG.headless,
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
            return `camden-scraped-data-${today}.json`;
        }
    },
    COOKIES: input.cookies && input.cookies.length > 0 ? input.cookies : (LOCAL_CONFIG.cookies || []),
};

console.log('Starting crawler with configuration:', {
    environment: isApify ? 'Apify' : 'Local',
    siteName: CONFIG.SITE.name,
    startUrl: CONFIG.SITE.startUrl,
    maxRequests: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? 'unlimited' : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless
});

// Array to store all extracted data (for regular crawler)
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
    browserPoolOptions: {
        useFingerprints: false,
        preLaunchHooks: [
            async (pageId, launchContext) => {
                launchContext.launchOptions = {
                    ...launchContext.launchOptions,
                    args: [
                        ...launchContext.launchOptions.args || [],
                        `--user-agent=${CONFIG.CRAWLER.userAgent}`
                    ]
                };
            }
        ]
    },
    // Add pre-navigation handler to set cookies
    preNavigationHooks: [
        async ({ page, request }) => {
            // Set cookies before navigation if we have any
            if (playwrightCookies.length > 0) {
                try {
                    await page.context().addCookies(playwrightCookies);
                    console.log(`🍪 Applied ${playwrightCookies.length} cookies to page context`);
                } catch (error) {
                    console.warn(`⚠️ Failed to set some cookies: ${error.message}`);
                }
            }
        }
    ],
    // Session pool options
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
        
        
        // Temporarily disable URL filtering for debugging
        // if (!shouldCrawlUrl(request.url, CONFIG.SITE)) {
        //     console.log(`Skipping URL outside allowed patterns: ${request.url}`);
        //     return;
        // }
        
        // This is the initial page load - handle pagination and sequential processing
        console.log('Starting on corporate entities page with query pagination');
        console.log(`Looking for selector: ${CONFIG.SELECTORS.specialistLinks}`);
        
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages) {
            console.log(`Processing page ${currentPage}...`);
            
            try {
                // Wait for the specialists content to load
                await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                console.log(`✅ Specialist links found on page ${currentPage}!`);
                
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
                
                console.log(`✅ Completed all ${entityLinks.length} entities on page ${currentPage}`);
                
                // Return to listing page for next page navigation
                const listingUrl = CONFIG.SITE.pagination.type === 'query' ? 
                    `${CONFIG.SITE.startUrl}&page=${currentPage}` : 
                    CONFIG.SITE.startUrl;
                await page.goto(listingUrl, { waitUntil: 'networkidle' });
                
                // Try to go to next page using query pagination
                if (CONFIG.SITE.pagination.type === 'ajax') {
                    console.log(`Attempting AJAX pagination from page ${currentPage}...`);
                    hasMorePages = await handleAjaxPagination(page, CONFIG);
                    
                    if (hasMorePages) {
                        currentPage++;
                        console.log(`Successfully moved to page ${currentPage}`);
                        // Small delay to ensure page is fully loaded
                        await page.waitForTimeout(1000);
                    } else {
                        console.log(`No more pages available after page ${currentPage}`);
                    }
                } else {
                    // Use query pagination for OpenGovSG
                    hasMorePages = await handleInitialPagination(page, enqueueLinks, CONFIG);
                    if (hasMorePages) currentPage++;
                }
                
            } catch (error) {
                console.log(`❌ Error on page ${currentPage}:`, error.message);
                
                // Debug: Check what's actually on the page
                const pageContent = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body',
                        linkCount: document.querySelectorAll('a').length,
                        divCount: document.querySelectorAll('div').length
                    };
                });
                console.log('Page content:', pageContent);
                
                // Try to find any links that might be specialist links
                const allLinks = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links.slice(0, 10).map(link => ({
                        text: link.textContent.trim(),
                        href: link.href,
                        className: link.className
                    }));
                });
                console.log('First 10 links on page:', allLinks);
                
                hasMorePages = false; // Stop pagination on error
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

console.log(`✅ Crawling completed! Found ${extractedData.length} specialists.`);
console.log(`📁 Data saved to: ${outputPath}`);

// Handle exit based on environment
await handleExit(Actor, isApify);