import { PlaywrightCrawler } from 'crawlee';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination } from './handlers/paginationHandler.js';
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
if (!input.outputFilename || input.outputFilename.trim() === '') {
    const errorMessage = `❌ CONFIGURATION ERROR: outputFilename is required and must be a non-empty string.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
}

// Import configuration from config.js
const { CONFIG: BASE_CONFIG } = await import('./config/config.js');

// Create configuration object using base config with output filename from input
const CONFIG = {
    ...BASE_CONFIG,
    OUTPUT: {
        getFilename: () => {
            if (input.outputFilename && input.outputFilename.trim() !== '') {
                return input.outputFilename.endsWith('.json') ? input.outputFilename : `${input.outputFilename}.json`;
            }
            return BASE_CONFIG.OUTPUT.getFilename();
        }
    }
};

console.log('Starting crawler with configuration:', {
    environment: isApify ? 'Apify' : 'Local',
    siteName: CONFIG.SITE.name,
    startUrl: CONFIG.SITE.startUrl,
    outputFilename: CONFIG.OUTPUT.getFilename(),
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
            ignoreHTTPSErrors: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-back-forward-cache',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-translate',
                '--disable-windows10-custom-titlebar',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            ]
        }
    },
    // Add pre-navigation handler to set cookies and stealth mode
    preNavigationHooks: [
        async ({ page, request }) => {
            // Randomly select user agent
            const randomUserAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
            
            // Set realistic headers and viewport
            await page.setViewportSize({ width: 1366, height: 768 });
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
                'User-Agent': randomUserAgent
            });

            // Set user agent
            await page.setUserAgent(randomUserAgent);

            // Set cookies before navigation if we have any
            if (playwrightCookies.length > 0) {
                try {
                    await page.context().addCookies(playwrightCookies);
                    console.log(`🍪 Applied ${playwrightCookies.length} cookies to page context`);
                } catch (error) {
                    console.warn(`⚠️ Failed to set some cookies: ${error.message}`);
                }
            }

            // Add stealth mode scripts
            await page.addInitScript(() => {
                // Remove webdriver property
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });

                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });

                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );

                // Mock chrome object
                window.chrome = {
                    runtime: {},
                };

                // Override the `plugins` property to use a custom getter
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });

                // Override the `languages` property to use a custom getter
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            });
        }
    ],
    // Session pool options
    sessionPoolOptions: {
        blockedStatusCodes: [], // Don't auto-block any status codes (including 403, 503)
        maxPoolSize: 1,
        sessionOptions: {
            maxErrorScore: 15, // Higher tolerance for "errors" 
            errorScoreDecrement: 0.3, // Slower error recovery
            maxAgeSecs: 1800, // 30 minutes session lifetime
        }
    },
    // Add delays between requests to avoid being detected as a bot
    requestHandlerTimeoutSecs: 90,
    navigationTimeoutSecs: 45,
    // Add random delays between requests
    minConcurrency: 1,
    maxConcurrency: 1,
    // Add proxy support (if available)
    proxyConfiguration: process.env.APIFY_PROXY_GROUPS ? {
        useApifyProxy: true,
        apifyProxyGroups: process.env.APIFY_PROXY_GROUPS.split(','),
        apifyProxyCountry: process.env.APIFY_PROXY_COUNTRY || 'US'
    } : undefined,
    // Handle failed requests with better retry logic
    failedRequestHandler: async ({ request, error }) => {
        console.error(`❌ Request failed: ${error.message}`);
        
        // Check if it's a network error that might be temporary
        if (error.message.includes('net::ERR_HTTP_RESPONSE_CODE_FAILURE') || 
            error.message.includes('net::ERR_CONNECTION_REFUSED') ||
            error.message.includes('net::ERR_TIMED_OUT')) {
            
            console.log(`🔄 Retrying request after delay: ${request.url}`);
            
            // Add exponential backoff delay
            const retryDelay = Math.min(30000, Math.pow(2, request.retryCount || 0) * 5000);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // Re-enqueue the request for retry
            return request;
        }
        
        // For other errors, don't retry
        console.log(`❌ Giving up on request after ${request.retryCount || 0} retries: ${request.url}`);
    },
    requestHandler: async ({ page, request, enqueueLinks }) => {
        // Add random delay between 3-8 seconds to mimic human behavior
        const delay = Math.random() * 5000 + 3000;
        console.log(`⏱️ Waiting ${Math.round(delay)}ms before processing request`);
        await page.waitForTimeout(delay);
        console.log(`Processing: ${request.url}`);

        // Add random mouse movements to simulate human behavior
        try {
            await page.mouse.move(Math.random() * 800 + 100, Math.random() * 600 + 100);
            await page.waitForTimeout(Math.random() * 1000 + 500);
        } catch (error) {
            // Ignore mouse movement errors
        }
        
        
        // Temporarily disable URL filtering for debugging
        // if (!shouldCrawlUrl(request.url, CONFIG.SITE)) {
        //     console.log(`Skipping URL outside allowed patterns: ${request.url}`);
        //     return;
        // }
        
        if (request.label === CONFIG.CRAWLER.labels.DETAIL) {
            // Extract specialist data from detail page
            const specialistData = await extractSpecialistData(page, request.url, CONFIG);
            extractedData.push(specialistData);
            
        } else if (request.label === CONFIG.CRAWLER.labels.SPECIALISTS_LIST) {
            // We are on a specialists listing page (page 2, 3, etc.)
            console.log(`Processing specialists listing page: ${request.url}`);
            
            // Wait for the specialists content to load
            await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
            
            // Enqueue all specialist profile links (debugging - no filtering)
            await enqueueLinks({
                selector: CONFIG.SELECTORS.specialistLinks,
                label: CONFIG.CRAWLER.labels.DETAIL,
                // transformRequestFunction: (req) => {
                //     // Filter URLs before adding to queue
                //     if (!shouldCrawlUrl(req.url, CONFIG.SITE)) {
                //         console.log(`Filtered out URL: ${req.url}`);
                //         return false; // Don't add to queue
                //     }
                //     return req;
                // }
            });
            
            // Handle pagination to next page
            await handlePagination(page, request.url, enqueueLinks, CONFIG);
            
        } else {
            // This is the initial page load
            console.log('Starting on specialists page');
            console.log(`Looking for selector: ${CONFIG.SELECTORS.specialistLinks}`);
            
            try {
                // Wait for the specialists content to load
                await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                console.log('✅ Specialist links selector found!');
            } catch (error) {
                console.log('❌ Specialist links selector NOT found. Trying to find what IS on the page...');
                
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
                
                throw error;
            }
            
            // Enqueue all specialist profile links from the first page (debugging - no filtering)
            await enqueueLinks({
                selector: CONFIG.SELECTORS.specialistLinks,
                label: CONFIG.CRAWLER.labels.DETAIL,
                // transformRequestFunction: (req) => {
                //     // Filter URLs before adding to queue
                //     if (!shouldCrawlUrl(req.url, CONFIG.SITE)) {
                //         console.log(`Filtered out URL: ${req.url}`);
                //         return false; // Don't add to queue
                //     }
                //     return req;
                // }
            });
            
            // Handle pagination for the first page
            await handleInitialPagination(page, enqueueLinks, CONFIG);
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

console.log(`✅ Crawling completed! Found ${extractedData.length} specialists.`);
console.log(`📁 Data saved to: ${outputPath}`);

// Handle exit based on environment
await handleExit(Actor, isApify);