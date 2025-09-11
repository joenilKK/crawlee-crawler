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
        delayBetweenLinks: LOCAL_CONFIG.delayBetweenLinks || 2000,
        delayBeforeNavigation: LOCAL_CONFIG.delayBeforeNavigation || 2000,
        delayAfterPageLoad: LOCAL_CONFIG.delayAfterPageLoad || 3000,
        ajaxPaginationDelay: LOCAL_CONFIG.ajaxPaginationDelay || 4000,
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

// Starting crawler silently

// Array to store all extracted data (for regular crawler)
let extractedData = [];

// Set to track processed URLs to avoid duplicates
let processedUrls = new Set();

// Create backup of existing file if needed
createBackupIfExists(CONFIG.OUTPUT.getFilename(), CONFIG);

// Convert cookies to Playwright format
const playwrightCookies = convertCookiesToPlaywrightFormat(CONFIG.COOKIES);


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
                } catch (error) {
                    // Silently handle cookie setting errors
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
    requestHandlerTimeoutSecs: 180, // Increased from 60 to 180 seconds
    navigationTimeoutSecs: 60, // Increased from 30 to 60 seconds
    // Add random delays between requests
    minConcurrency: 1,
    maxConcurrency: 1,
    // Handle failed requests with retry logic
    failedRequestHandler: async ({ request, error }) => {
        // Silently handle failed requests
    },
    // Increase max retries but with specific conditions
    maxRequestRetries: 2,
    requestHandler: async ({ page, request, enqueueLinks }) => {
        // Add random delay between 2-5 seconds to mimic human behavior
        const delay = Math.random() * 3000 + 2000;
        await page.waitForTimeout(delay);
        
        
        // Temporarily disable URL filtering for debugging
        // if (!shouldCrawlUrl(request.url, CONFIG.SITE)) {
        //     console.log(`Skipping URL outside allowed patterns: ${request.url}`);
        //     return;
        // }
        
        // Handle all processing on the main specialists listing page
        {
            // This is the initial page load - handle AJAX pagination efficiently
            
            console.log("Extracting....");
            
            let currentPage = 1;
            let hasMorePages = true;
            let totalDoctorsProcessed = 0;
            
            while (hasMorePages) {
                
                try {
                    // Wait for the specialists content to load
                    await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                    
                    // Get all doctor links on current page
                    const doctorLinks = await page.evaluate((selector) => {
                        const links = Array.from(document.querySelectorAll(selector));
                        return links.map(link => ({
                            url: link.href,
                            text: link.textContent.trim()
                        }));
                    }, CONFIG.SELECTORS.specialistLinks);
                    
                    
                     // Process each doctor on this page immediately
                     for (let i = 0; i < doctorLinks.length; i++) {
                         // Check if we've reached the maximum number of SUCCESSFULLY EXTRACTED doctors
                         if (CONFIG.CRAWLER.maxRequestsPerCrawl !== -1 && totalDoctorsProcessed >= CONFIG.CRAWLER.maxRequestsPerCrawl) {
                             hasMorePages = false;
                             break;
                         }
                        
                        const doctor = doctorLinks[i];
                        
                        // Skip if we've already processed this URL
                        if (processedUrls.has(doctor.url)) {
                            continue;
                        }
                        
                        // Add URL to processed set
                        processedUrls.add(doctor.url);
                        
                        
                        // Add delay before processing each doctor link to avoid overwhelming the server
                        if (i > 0 || currentPage > 1) { // Skip delay for the very first doctor
                            await page.waitForTimeout(CONFIG.CRAWLER.delayBetweenLinks);
                        }
                        
                        let doctorPage = null;
                        try {
                            // Add delay before navigation to avoid overwhelming the server
                            await page.waitForTimeout(CONFIG.CRAWLER.delayBeforeNavigation);
                            
                            // Open doctor detail page in new tab
                            doctorPage = await page.context().newPage();
                            
                            // Set longer timeout for navigation
                            await doctorPage.goto(doctor.url, { 
                                waitUntil: 'networkidle',
                                timeout: 60000 // 60 second timeout for navigation
                            });
                            
                            // Wait for page to be fully stable after load
                            await doctorPage.waitForTimeout(CONFIG.CRAWLER.delayAfterPageLoad);
                            
                            // Extract doctor data
                            const doctorData = await extractSpecialistData(doctorPage, doctor.url, CONFIG);
                            
                            // Only add valid data and increment counter for valid records
                            if (doctorData) {
                                extractedData.push(doctorData);
                                totalDoctorsProcessed++;
                            }
                            
                        } catch (error) {
                            // Silently handle errors during extraction
                        } finally {
                            // Always close the doctor page in finally block
                            if (doctorPage && !doctorPage.isClosed()) {
                                try {
                                    await doctorPage.close();
                                } catch (closeError) {
                                    // Ignore close errors
                                }
                            }
                            
                            // Additional small delay after processing
                            try {
                                await page.waitForTimeout(1500);
                            } catch (timeoutError) {
                                // Ignore timeout errors if main page is closed
                            }
                        }
                    }
                    
                     // After processing all doctors on current page, check if we should continue to next page
                     // Don't continue if we've reached the maximum limit of successfully extracted doctors
                     if (CONFIG.CRAWLER.maxRequestsPerCrawl !== -1 && totalDoctorsProcessed >= CONFIG.CRAWLER.maxRequestsPerCrawl) {
                         hasMorePages = false;
                    } else if (CONFIG.SITE.pagination.type === 'ajax') {
                        hasMorePages = await handleAjaxPagination(page, CONFIG);
                        
                        if (hasMorePages) {
                            currentPage++;
                            // Extended delay to ensure page is fully loaded and stable
                            await page.waitForTimeout(CONFIG.CRAWLER.ajaxPaginationDelay);
                        }
                    } else {
                        // Fallback to traditional pagination if not AJAX
                        hasMorePages = await handleInitialPagination(page, enqueueLinks, CONFIG);
                        if (hasMorePages) currentPage++;
                    }
                    
                } catch (error) {
                    // Silently handle page errors
                    if (error.message.includes('Target page, context or browser has been closed')) {
                        hasMorePages = false; // Stop if browser/context is closed
                    } else {
                        // For other errors, try to continue to next page
                        hasMorePages = false; // For now, stop on any error to be safe
                    }
                }
            }
            
            console.log("Done Extracting");
        }
    },
    maxRequestsPerCrawl: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? undefined : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
});

await crawler.run([CONFIG.SITE.startUrl]);

// Save extracted data to JSON file
const outputPath = await saveDataToFile(extractedData, CONFIG, CONFIG.COOKIES);

// Handle data output based on environment
await handleDataOutput(extractedData, CONFIG, Actor, isApify, CONFIG.COOKIES);

// Crawling completed silently

// Handle exit based on environment
await handleExit(Actor, isApify);