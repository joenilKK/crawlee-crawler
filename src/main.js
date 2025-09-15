import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';
import { BrowserName, DeviceCategory, OperatingSystemsName } from '@crawlee/browser-pool';
import { chromium } from 'playwright';
import { Actor } from 'apify';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination, handleAjaxPagination } from './handlers/paginationHandler.js';
import { shouldCrawlUrl } from './utils/helpers.js';
import { ProxyManager } from './utils/proxyManager.js';
import { 
    getConfiguration, 
    handleDataOutput, 
    handleExit 
} from './config/environment.js';

/**
 * Extract data from a single entity using a fresh browser instance with retry logic
 * @param {string} entityUrl - URL of the entity to extract
 * @param {Object} config - Configuration object
 * @returns {Object} - Extracted entity data or error info
 */
async function extractEntityWithFreshBrowser(entityUrl, config) {
    const maxRetries = config.CRAWLER?.maxRetries || 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let browser = null;
        let page = null;
        
        try {
            console.log(`🆕 Starting fresh browser for: ${entityUrl} (attempt ${attempt}/${maxRetries})`);
            
            // Get proxy configuration for this request
            let proxyConfig = {};
            let proxyUrl = null;
            if (config.PROXY?.apifyProxyConfig) {
                // Apify handles proxy configuration internally
                console.log('🌐 Using Apify proxy configuration for fresh browser');
            } else {
                // Use custom proxy configuration for local development
                proxyUrl = proxyManager.getNextProxy(config.PROXY?.rotation || 'perRequest');
                proxyConfig = proxyManager.getPlaywrightProxyConfig(proxyUrl);
            }
            
            // Create fresh browser instance with proxy if configured
            const launchOptions = {
                headless: config.LOCAL_CONFIG?.headless !== false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-web-security', // Help prevent ad interference
                    '--disable-features=VizDisplayCompositor', // Reduce ad rendering issues
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--memory-pressure-off',
                    '--max_old_space_size=2048',
                    '--no-crash-upload',
                    '--disable-breakpad',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-default-apps',
                    '--disable-sync'
                ]
            };

            // Add proxy configuration if available (only for local development)
            if (proxyConfig.server) {
                launchOptions.proxy = proxyConfig;
                console.log(`🌐 Using proxy: ${proxyManager.maskProxyUrl(proxyUrl)}`);
            }

            browser = await chromium.launch(launchOptions);
            
            page = await browser.newPage();
            
            // Block ads and trackers to prevent interference
            await page.route('**/*', (route) => {
                const url = route.request().url();
                if (url.includes('google') && (url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication'))) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            
            // Set timeouts
            page.setDefaultTimeout(config.LOCAL_CONFIG?.timeout || 10000);
            page.setDefaultNavigationTimeout(config.LOCAL_CONFIG?.timeout || 10000);
            
            // Navigate to entity page with retry logic
            console.log(`📄 Navigating to: ${entityUrl}`);
            const response = await page.goto(entityUrl, { waitUntil: 'networkidle' });
            
            // Check if request was blocked
            if (response && (response.status() === 403 || response.status() === 429 || response.status() === 503)) {
                throw new Error(`Request blocked with status ${response.status()}`);
            }
            
            // Wait a bit for page to stabilize
            await page.waitForTimeout(1000);
            
            // Extract data
            console.log(`🔍 Extracting data from: ${entityUrl}`);
            const entityData = await extractSpecialistData(page, entityUrl, config);
            entityData.url = entityUrl;
            
            console.log(`✅ Successfully extracted: ${entityData.entityName || 'Unknown'}`);
            
            // Mark proxy as successful
            if (proxyUrl) {
                proxyManager.markProxySuccess(proxyUrl);
            }
            
            return { success: true, data: entityData };
            
        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${entityUrl}:`, error.message);
            
            // Mark proxy as failed if it was a network/proxy error
            if (proxyUrl && (error.message.includes('proxy') || error.message.includes('network') || 
                error.message.includes('timeout') || error.message.includes('ECONNREFUSED') ||
                error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT'))) {
                proxyManager.markProxyFailed(proxyUrl, error);
            }
            
            // If this is not the last attempt, wait before retrying
            if (attempt < maxRetries) {
                const retryDelay = config.CRAWLER?.retryInterval || 5000;
                console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        } finally {
            // Always cleanup
            try {
                if (page) await page.close();
                if (browser) await browser.close();
                console.log(`🧹 Cleaned up browser for: ${entityUrl}`);
            } catch (cleanupError) {
                console.warn(`⚠️ Cleanup warning for ${entityUrl}:`, cleanupError.message);
            }
        }
    }
    
    // All retries failed
    console.error(`❌ All ${maxRetries} attempts failed for ${entityUrl}`);
    return { 
        success: false, 
        error: lastError?.message || 'Unknown error',
        data: {
            url: entityUrl,
            entityName: 'Extraction failed',
            overview: [],
            error: lastError?.message || 'Unknown error'
        }
    };
}

/**
 * Check if page and browser context are still alive
 * @param {Page} page - Playwright page object
 * @returns {boolean} - true if page is alive, false otherwise
 */
async function isPageAlive(page) {
    try {
        if (!page || page.isClosed()) {
            return false;
        }
        
        // Try a simple operation to check if page is responsive
        await page.evaluate(() => document.title);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Create a new browser page when the current one is dead
 * @param {Browser} browser - Playwright browser object
 * @returns {Promise<Page>} - New page object
 */
async function createNewPage(browser) {
    try {
        const context = await browser.newContext({
            userAgent: CONFIG.CRAWLER.userAgent,
            ignoreHTTPSErrors: true
        });
        
        const page = await context.newPage();
        console.log('🔄 Created new browser page due to previous page being closed');
        return page;
    } catch (error) {
        console.error('Failed to create new page:', error);
        throw error;
    }
}

/**
 * Safe navigation with retry logic
 * @param {Page} page - Playwright page object
 * @param {string} url - URL to navigate to
 * @param {Object} options - Navigation options
 * @returns {Promise<void>}
 */
async function safeGoto(page, url, options = {}) {
    const maxAttempts = 3;
    let attempt = 1;
    
    while (attempt <= maxAttempts) {
        try {
            if (!(await isPageAlive(page))) {
                throw new Error('Page is not alive');
            }
            
            await page.goto(url, { 
                waitUntil: 'networkidle',
                timeout: 30000,
                ...options 
            });
            return; // Success
            
        } catch (error) {
            console.log(`Navigation attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
            
            if (attempt === maxAttempts) {
                throw error; // Final attempt failed
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            attempt++;
        }
    }
}

/**
 * Safe wait with page validation
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
async function safeWaitForTimeout(page, timeout) {
    try {
        if (!(await isPageAlive(page))) {
            throw new Error('Page is not alive');
        }
        
        await page.waitForTimeout(timeout);
    } catch (error) {
        console.log(`Safe wait failed: ${error.message}`);
        // Use regular setTimeout as fallback
        await new Promise(resolve => setTimeout(resolve, timeout));
    }
}

/**
 * Proactive page health maintenance
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function maintainPageHealth(page) {
    try {
        // Clear browser cache and memory periodically
        await page.evaluate(() => {
            // Clear console
            if (console.clear) console.clear();
            
            // Force garbage collection if available
            if (window.gc) window.gc();
            
            // Clear any intervals/timeouts
            const highestTimeoutId = setTimeout(() => {}, 0);
            for (let i = 0; i < highestTimeoutId; i++) {
                clearTimeout(i);
                clearInterval(i);
            }
        });
        
        // Add a small delay to let cleanup complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
    } catch (error) {
        // Ignore errors during cleanup
    }
}

/**
 * Refresh page connection to prevent staleness
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function refreshPageConnection(page) {
    try {
        // Navigate to about:blank and back to reset page state
        await page.goto('about:blank', { waitUntil: 'load', timeout: 5000 });
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
        // Ignore refresh errors
    }
}

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

// Debug logging for proxy configuration
console.log('🔍 Input received:', JSON.stringify(input, null, 2));
console.log('🔍 Is Apify environment:', isApify);
console.log('🔍 Proxy configuration in input:', input.proxyConfiguration);

// No input validation needed - all settings come from local config

// Import local configuration for hardcoded values
const { LOCAL_CONFIG } = await import('./config/local-config.js');

// Create configuration object using local config with input overrides
const CONFIG = {
    SITE: {
        name: LOCAL_CONFIG.siteName,
        baseUrl: LOCAL_CONFIG.baseUrl,
        startUrl: process.env.TARGET_PAGE_URL || LOCAL_CONFIG.startUrl,
        allowedUrlPatterns: LOCAL_CONFIG.allowedUrlPatterns,
        excludedUrlPatterns: LOCAL_CONFIG.excludedUrlPatterns || [],
        pagination: {
            type: LOCAL_CONFIG.paginationType,
            queryPattern: LOCAL_CONFIG.queryPattern || 'page={page}',
            pathPattern: LOCAL_CONFIG.pathPattern || '/page/{page}/',
            baseUrl: LOCAL_CONFIG.paginationBaseUrl || null,
            startPage: LOCAL_CONFIG.startPage || 1,
            maxPages: LOCAL_CONFIG.maxPages || 11
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
        maxRequestsPerCrawl: process.env.MAX_REQUESTS ? parseInt(process.env.MAX_REQUESTS) : LOCAL_CONFIG.maxRequestsPerCrawl,
        headless: LOCAL_CONFIG.headless,
        timeout: input.maxRequestTimeout ? input.maxRequestTimeout * 1000 : LOCAL_CONFIG.timeout, // Convert seconds to milliseconds
        maxRetries: input.maxRetries || LOCAL_CONFIG.maxRetries,
        browserRestartCount: LOCAL_CONFIG.browserRestartCount,
        requestInterval: LOCAL_CONFIG.requestInterval,
        pageInterval: LOCAL_CONFIG.pageInterval,
        retryInterval: LOCAL_CONFIG.retryInterval,
        entityInterval: LOCAL_CONFIG.entityInterval,
        userAgent: LOCAL_CONFIG.userAgent,
        maxRotationPerSession: input.maxRotationPerSession || LOCAL_CONFIG.maxRotationPerSession || 10,
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
    PROXY: {
        // Handle Apify proxy configuration vs local config
        enabled: isApify ? !!input.proxyConfiguration : (LOCAL_CONFIG.proxy?.enabled || false),
        urls: isApify ? [] : (LOCAL_CONFIG.proxy?.urls || []), // Apify handles proxy URLs internally
        country: isApify ? (input.proxyConfiguration?.country || 'US') : (LOCAL_CONFIG.proxy?.country || 'US'),
        rotation: isApify ? (input.proxyConfiguration?.rotation || 'perRequest') : (LOCAL_CONFIG.proxy?.rotation || 'perRequest'),
        retryCount: isApify ? (input.proxyConfiguration?.retryCount || 3) : (LOCAL_CONFIG.proxy?.retryCount || 3),
        timeout: isApify ? ((input.proxyConfiguration?.timeout || 30) * 1000) : ((LOCAL_CONFIG.proxy?.timeout || 30) * 1000),
        retryDelay: LOCAL_CONFIG.proxy?.retryDelay || 5000,
        bypassUrls: LOCAL_CONFIG.proxy?.bypassUrls || [],
        maxConcurrentRequests: LOCAL_CONFIG.proxy?.maxConcurrentRequests || 1,
        healthCheckInterval: LOCAL_CONFIG.proxy?.healthCheckInterval || 60000,
        blacklistFailedProxies: LOCAL_CONFIG.proxy?.blacklistFailedProxies !== false,
        blacklistDuration: LOCAL_CONFIG.proxy?.blacklistDuration || 300000,
        // Apify-specific proxy configuration
        apifyProxyConfig: null // Will be created using Actor.createProxyConfiguration() if needed
    }
};

// Initialize proxy manager
const proxyManager = new ProxyManager(CONFIG);

// Create Apify proxy configuration if in Apify environment
let apifyProxyConfig = null;
if (isApify && input.proxyConfiguration) {
    try {
        // Pass the entire proxyConfiguration object directly to Actor.createProxyConfiguration()
        apifyProxyConfig = await Actor.createProxyConfiguration(input.proxyConfiguration);
        console.log('✅ Apify proxy configuration created successfully');
    } catch (error) {
        console.error('❌ Failed to create Apify proxy configuration:', error.message);
        apifyProxyConfig = null;
    }
}

console.log('Starting crawler with configuration:', {
    environment: isApify ? 'Apify' : 'Local',
    siteName: CONFIG.SITE.name,
    startUrl: CONFIG.SITE.startUrl,
    maxRequests: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? 'unlimited' : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
    proxyEnabled: CONFIG.PROXY.enabled,
    proxyCount: CONFIG.PROXY.urls.length
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

// Get initial proxy configuration for main crawler
let mainProxyConfig = {};
if (isApify && CONFIG.PROXY.apifyProxyConfig) {
    // Use Apify's proxy configuration
    console.log('🌐 Using Apify proxy configuration');
    // Apify handles proxy configuration internally through the Actor
} else {
    // Use custom proxy configuration for local development
    const mainProxyUrl = proxyManager.getNextProxy(CONFIG.PROXY?.rotation || 'perRequest');
    mainProxyConfig = proxyManager.getPlaywrightProxyConfig(mainProxyUrl);
}

const crawler = new PlaywrightCrawler({
    // Use Apify proxy configuration if available
    ...(apifyProxyConfig && { proxyConfiguration: apifyProxyConfig }),
    launchContext: {
        launchOptions: {
            ignoreHTTPSErrors: true,
            ...(mainProxyConfig.server && { proxy: mainProxyConfig }),
            args: [
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
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--enable-automation',
                '--disable-default-apps',
                '--disable-sync',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--password-store=basic',
                '--use-mock-keychain',
                '--memory-pressure-off',
                '--max_old_space_size=2048',
                '--disable-ipc-flooding-protection',
                '--disable-features=TranslateUI',
                '--disable-client-side-phishing-detection',
                '--disable-popup-blocking',
                '--disable-prompt-on-repost',
                '--no-crash-upload',
                '--disable-breakpad',
                `--user-agent=${CONFIG.CRAWLER.userAgent}`
            ]
        }
    },
    // Set lower concurrency to be respectful and stable
    maxConcurrency: 1,
    minConcurrency: 1,
    // Browser pool options for stability
    browserPoolOptions: {
        useFingerprints: true,
        maxOpenPagesPerBrowser: 1, // Only one page per browser to prevent resource conflicts
        retireBrowserAfterPageCount: LOCAL_CONFIG.browserRestartCount || 3, // Restart browser every N pages to prevent memory leaks
        fingerprintOptions: {
          fingerprintGeneratorOptions: {
              browsers: [{
                  name: BrowserName.edge,
                  minVersion: 96,
              }],
              devices: [
                  DeviceCategory.desktop,
              ],
              operatingSystems: [
                  OperatingSystemsName.windows,
              ],
          },
      },
    },
    
    // Handle session pool configuration
    sessionPoolOptions: {
        blockedStatusCodes: [], // Don't auto-block any status codes (including 403, 503)
        maxPoolSize: 1,
        sessionOptions: {
            maxErrorScore: 15, // Higher tolerance for "errors" 
            errorScoreDecrement: 0.3, // Slower error recovery
        }
    },
    // Enable retry on blocked requests
    retryOnBlocked: true,
    // Increase timeouts to prevent premature closures (increased for fresh browser approach)
    requestHandlerTimeoutSecs: 3600, // 1 hour for the main handler (to handle all 1100+ entities)
    navigationTimeoutSecs: 180, // 3 minutes for navigation
    // Handle failed requests
    failedRequestHandler: async ({ request, error }) => {
        console.error(`❌ Request failed: ${error.message}`);
    },
    requestHandler: async ({ page, request, enqueueLinks }) => {
        // Add random delay between 2-5 seconds to mimic human behavior
        const delay = Math.random() * 3000 + 2000;
        console.log(`⏱️ Waiting ${Math.round(delay)}ms before processing request`);
        await safeWaitForTimeout(page, delay);
        console.log(`Processing: ${request.url}`);
        
        // This is the main entry point - start sequential processing
        console.log('Starting sequential corporate entity extraction');
        console.log(`Looking for selector: ${CONFIG.SELECTORS.specialistLinks}`);
        
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages) {
            console.log(`\n🔄 ==================== PROCESSING PAGE ${currentPage} ====================`);
            
            const maxPageRetries = CONFIG.CRAWLER?.maxRetries || 3;
            let pageProcessed = false;
            let pageError = null;
            
            for (let pageAttempt = 1; pageAttempt <= maxPageRetries && !pageProcessed; pageAttempt++) {
                try {
                    console.log(`🔄 Processing page ${currentPage} (attempt ${pageAttempt}/${maxPageRetries})`);
                    
                    // Use fresh browser to get entity links for current page
                    let currentPageUrl;
                    if (currentPage === 1) {
                        currentPageUrl = LOCAL_CONFIG.paginationBaseUrl || CONFIG.SITE.startUrl;
                    } else {
                        // Construct proper page URL using the pagination base URL
                        const baseUrl = LOCAL_CONFIG.paginationBaseUrl || CONFIG.SITE.startUrl.replace(/[?&]page=\d+/, '');
                        const separator = baseUrl.includes('?') ? '&' : '?';
                        currentPageUrl = `${baseUrl}${separator}page=${currentPage}`;
                    }
                    
                    let listingBrowser = null;
                    let listingPage = null;
                    let entityLinks = [];
                    
                    try {
                        console.log(`🆕 Creating fresh browser for page ${currentPage}: ${currentPageUrl}`);
                        
                        // Get proxy configuration for listing page
                        const listingProxyUrl = proxyManager.getNextProxy(CONFIG.PROXY?.rotation || 'perRequest');
                        const listingProxyConfig = proxyManager.getPlaywrightProxyConfig(listingProxyUrl);
                        
                        const listingLaunchOptions = {
                            headless: LOCAL_CONFIG?.headless !== false,
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-dev-shm-usage',
                                '--memory-pressure-off',
                                '--disable-web-security', // Help prevent ad interference
                                '--disable-features=VizDisplayCompositor' // Reduce ad rendering issues
                            ]
                        };

                        // Add proxy configuration if available
                        if (listingProxyConfig.server) {
                            listingLaunchOptions.proxy = listingProxyConfig;
                            console.log(`🌐 Using proxy for listing: ${proxyManager.maskProxyUrl(listingProxyUrl)}`);
                        }

                        listingBrowser = await chromium.launch(listingLaunchOptions);
                        
                        listingPage = await listingBrowser.newPage();
                        listingPage.setDefaultTimeout(LOCAL_CONFIG?.timeout || 30000);
                        
                        // Block ads and trackers to prevent interference
                        await listingPage.route('**/*', (route) => {
                            const url = route.request().url();
                            if (url.includes('google') && (url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication'))) {
                                route.abort();
                            } else {
                                route.continue();
                            }
                        });
                        
                        // Navigate with retry logic for blocked requests
                        const response = await listingPage.goto(currentPageUrl, { waitUntil: 'networkidle' });
                        
                        // Check if request was blocked
                        if (response && (response.status() === 403 || response.status() === 429 || response.status() === 503)) {
                            throw new Error(`Request blocked with status ${response.status()}`);
                        }
                        
                        await listingPage.waitForTimeout(2000);
                        
                        // Wait for the entity links to load
                        await listingPage.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                        console.log(`✅ Entity links found on page ${currentPage}!`);
                        
                        // Get all entity links on current page
                        entityLinks = await listingPage.evaluate((selector) => {
                            const links = document.querySelectorAll(selector);
                            return Array.from(links).map(link => link.href).filter(href => href);
                        }, CONFIG.SELECTORS.specialistLinks);
                        
                    } finally {
                        // Don't close the listing browser yet - we need it for pagination
                        console.log(`📝 Keeping listing browser open for pagination check`);
                    }
                
                    console.log(`Found ${entityLinks.length} entities on page ${currentPage}`);
                    console.log(`🚀 Starting to process all ${entityLinks.length} entities from page ${currentPage}`);
                    
                    // Process each entity using fresh browser instances (eliminates ALL browser failures)
                    for (let i = 0; i < entityLinks.length; i++) {
                        const entityUrl = entityLinks[i];
                        console.log(`\n📋 Processing entity ${i + 1}/${entityLinks.length} on page ${currentPage}`);
                        
                        // Add interval between requests to prevent overwhelming the server
                        if (i > 0) {
                            const interval = LOCAL_CONFIG.requestInterval || 5000;
                            console.log(`⏳ Waiting ${interval}ms before processing next entity...`);
                            await new Promise(resolve => setTimeout(resolve, interval));
                        }
                        
                        // Extract data using fresh browser instance (eliminates all browser persistence issues)
                        const result = await extractEntityWithFreshBrowser(entityUrl, CONFIG);
                        
                        // Add the data to our collection
                        extractedData.push(result.data);
                        
                        // Save data after each extraction (incremental save)
                        await saveDataToFile(extractedData, CONFIG);
                        
                        if (result.success) {
                            console.log(`✅ Successfully completed entity ${i + 1}/${entityLinks.length}: ${result.data.entityName}`);
                        } else {
                            console.log(`⚠️ Failed entity ${i + 1}/${entityLinks.length}: ${entityUrl} (saved as error entry)`);
                        }
                        
                        // Brief pause after each entity to be respectful to server
                        const entityInterval = LOCAL_CONFIG.entityInterval || 3000;
                        console.log(`⏳ Waiting ${entityInterval}ms after entity processing...`);
                        await new Promise(resolve => setTimeout(resolve, entityInterval));
                    }
                    
                    console.log(`✅ Completed all ${entityLinks.length} entities on page ${currentPage}`);
                    pageProcessed = true; // Mark page as successfully processed
                    
                } catch (error) {
                    pageError = error;
                    console.error(`❌ Page ${currentPage} attempt ${pageAttempt}/${maxPageRetries} failed:`, error.message);
                    
                    // Mark listing proxy as failed if it was a network/proxy error
                    if (listingProxyUrl && (error.message.includes('proxy') || error.message.includes('network') || 
                        error.message.includes('timeout') || error.message.includes('ECONNREFUSED') ||
                        error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT'))) {
                        proxyManager.markProxyFailed(listingProxyUrl, error);
                    }
                    
                    // If this is not the last attempt, wait before retrying
                    if (pageAttempt < maxPageRetries) {
                        const retryDelay = CONFIG.CRAWLER?.retryInterval || 10000;
                        console.log(`⏳ Waiting ${retryDelay}ms before retrying page ${currentPage}...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            
            // If page processing failed after all retries, skip to next page
            if (!pageProcessed) {
                console.error(`❌ Failed to process page ${currentPage} after ${maxPageRetries} attempts:`, pageError?.message);
                console.log(`⏭️ Skipping to next page...`);
                currentPage++;
                continue;
            }
            
            // Reset proxy rotation for new page if configured
            if (CONFIG.PROXY.rotation === 'perPage') {
                proxyManager.resetRotation();
            }
            
            // Check for next page button and click it
            console.log(`🔍 Looking for next page button after completing page ${currentPage}...`);
            
            try {
                // Look for the next button using the nextButtonSelector
                const nextButtonSelector = LOCAL_CONFIG.nextButtonSelector;
                console.log(`🔍 Looking for next button with selector: ${nextButtonSelector}`);
                
                const nextButton = await listingPage.$(nextButtonSelector);
                
                if (nextButton) {
                    // Check the text content of the next button
                    const buttonText = await listingPage.evaluate((button) => {
                        return button.textContent.trim();
                    }, nextButton);
                    
                    console.log(`🔍 Next button text: "${buttonText}"`);
                    
                    // If button text is NOT "Next Page", we've reached the last page
                    if (buttonText !== "Next Page") {
                        console.log(`🏁 Button text is "${buttonText}" (not "Next Page") - this is the last page of pagination`);
                        console.log(`✅ Scraping completed! Successfully processed ${currentPage} pages total.`);
                        hasMorePages = false;
                        break; // Exit the pagination loop completely
                    }
                    
                    // Button text IS "Next Page", so more pages are available
                    console.log(`✅ Button text is "Next Page" - more pages available, proceeding to next page...`);
                    
                    // Also check if the next button is disabled
                    const isDisabled = await listingPage.evaluate((button) => {
                        const parentLi = button.closest('li');
                        return button.disabled || 
                               button.classList.contains('disabled') || 
                               (parentLi && parentLi.classList.contains('disabled')) ||
                               button.getAttribute('aria-disabled') === 'true';
                    }, nextButton);
                    
                    if (isDisabled) {
                        console.log(`📄 Next button is disabled - reached end of pagination at page ${currentPage}`);
                        hasMorePages = false;
                        continue;
                    }
                    
                    console.log(`🖱️ Found "Next Page" button - navigating to next page ${currentPage + 1}`);
                    
                    // Extract href and navigate directly (more reliable than clicking)
                    const nextPageUrl = await listingPage.evaluate((selector) => {
                        const button = document.querySelector(selector);
                        return button ? button.href : null;
                    }, nextButtonSelector);
                    
                    if (nextPageUrl) {
                        console.log(`🌐 Navigating directly to: ${nextPageUrl}`);
                        await listingPage.goto(nextPageUrl, { waitUntil: 'load', timeout: 60000 });
                        currentPage++;
                        console.log(`✅ Successfully navigated to page ${currentPage}`);
                        
                        // Wait a bit for the page to fully load
                        const pageInterval = LOCAL_CONFIG.pageInterval || 10000;
                        console.log(`⏳ Waiting ${pageInterval}ms for page ${currentPage} to fully load...`);
                        await new Promise(resolve => setTimeout(resolve, pageInterval));
                        
                        // Continue to next iteration to process the new page
                        continue;
                    } else {
                        console.log(`❌ Could not extract next page URL from button`);
                        hasMorePages = false;
                        break;
                    }
                    
                } else {
                    console.log(`🏁 No next button found - this is the last page of pagination`);
                    console.log(`✅ Scraping completed! Successfully processed ${currentPage} pages total.`);
                    hasMorePages = false;
                    break; // Exit the pagination loop completely
                }
                
            } catch (nextButtonError) {
                console.log(`❌ Error clicking next button: ${nextButtonError.message}`);
                hasMorePages = false;
                continue;
            } finally {
                // Clean up listing browser after pagination check
                try {
                    if (listingPage) await listingPage.close();
                    if (listingBrowser) await listingBrowser.close();
                    console.log(`🧹 Cleaned up listing browser after pagination check`);
                } catch (cleanupError) {
                    console.warn(`⚠️ Cleanup warning for listing browser:`, cleanupError.message);
                }
            }
        }
        
        console.log(`✅ Completed processing all pages. Total pages processed: ${currentPage}`);
        console.log(`📊 Total entities extracted: ${extractedData.length}`);
        
        // Calculate expected vs actual
        if (currentPage >= 11) {
            console.log(`🎯 Successfully reached expected 11+ pages of pagination!`);
        } else {
            console.log(`⚠️ Only processed ${currentPage} pages - expected 11 pages`);
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

console.log(`✅ Crawling completed! Found ${extractedData.length} entities.`);
console.log(`📁 Data saved to: ${outputPath}`);

// Log proxy statistics if proxy was enabled
if (CONFIG.PROXY.enabled) {
    console.log('\n🌐 Proxy Statistics:');
    const proxyStats = proxyManager.getStats();
    console.log(`📊 Total proxies: ${proxyStats.totalProxies}`);
    console.log(`✅ Available proxies: ${proxyStats.availableProxies}`);
    console.log(`❌ Blacklisted proxies: ${proxyStats.blacklistedProxies}`);
    
    if (proxyStats.proxyDetails.length > 0) {
        console.log('\n📋 Proxy Details:');
        proxyStats.proxyDetails.forEach((proxy, index) => {
            console.log(`  ${index + 1}. ${proxy.url}`);
            console.log(`     Success: ${proxy.success}, Failed: ${proxy.failed}, Rate: ${proxy.successRate}`);
            console.log(`     Last used: ${proxy.lastUsed}, Blacklisted: ${proxy.isBlacklisted ? 'Yes' : 'No'}`);
        });
    }
}

// Handle exit based on environment
await handleExit(Actor, isApify);
