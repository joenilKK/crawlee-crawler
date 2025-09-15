import { PlaywrightCrawler } from 'crawlee';
import { BrowserName, DeviceCategory, OperatingSystemsName } from '@crawlee/browser-pool';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination, handleAjaxPagination } from './handlers/paginationHandler.js';
import { shouldCrawlUrl } from './utils/helpers.js';
import { 
    getConfiguration, 
    handleDataOutput, 
    handleExit 
} from './config/environment.js';
import { 
    generateBrowserFingerprint, 
    getStealthBrowserArgs, 
    configureStealthPage, 
    simulateHumanInteraction, 
    detectBotProtection, 
    handleBotDetection,
    getHumanLikeDelay 
} from './utils/antiDetection.js';
import { createProxyManager } from './utils/proxyManager.js';

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

// No validation needed - crawler runs unlimited by default

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
    PROXY: {
        enabled: input.proxyConfiguration?.enabled || false,
        proxies: input.proxyConfiguration?.proxies || [],
        rotationStrategy: input.proxyConfiguration?.rotationStrategy || 'round_robin',
        maxFailures: input.maxRetries || 3,
        maxRotationPerSession: input.maxRotationPerSession || 10,
        maxRequestTimeout: input.maxRequestTimeout || 30
    }
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

// Initialize proxy manager with configuration
console.log('🔧 Proxy Configuration Debug:');
console.log('   Input proxyConfiguration:', JSON.stringify(input.proxyConfiguration, null, 2));
console.log('   CONFIG.PROXY:', JSON.stringify(CONFIG.PROXY, null, 2));

const proxyManager = createProxyManager(CONFIG.PROXY);

// Generate browser fingerprint for this session
const browserFingerprint = generateBrowserFingerprint();

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: CONFIG.CRAWLER.headless,
            ignoreHTTPSErrors: true,
            // Set viewport size for consistent browser window dimensions
            viewport: {
                width: browserFingerprint.viewport.width,
                height: browserFingerprint.viewport.height
            },
            args: [
                ...getStealthBrowserArgs(),
                `--user-agent=${browserFingerprint.userAgent}`,
                `--window-size=${browserFingerprint.viewport.width},${browserFingerprint.viewport.height}`,
                `--lang=${browserFingerprint.languages[0]}`,
                `--timezone=${browserFingerprint.timezone}`
            ]
        }
    },
    browserPoolOptions: {
        useFingerprints: true,
        fingerprintOptions: {
            fingerprintGeneratorOptions: {
                browsers: [
                    {
                        name: BrowserName.edge,
                        minVersion: 96,
                    },
                ],
                devices: [DeviceCategory.desktop],
                operatingSystems: [OperatingSystemsName.windows],
            },
        },
        preLaunchHooks: [
            async (pageId, launchContext) => {
                console.log(`🔧 PreLaunch Hook Debug for pageId: ${pageId}`);
                console.log(`   CONFIG.PROXY.enabled: ${CONFIG.PROXY.enabled}`);
                console.log(`   Proxy manager proxies count: ${proxyManager.proxies.length}`);
                
                // Get proxy for this browser instance if enabled
                if (CONFIG.PROXY.enabled) {
                    const proxy = proxyManager.getNextProxy();
                    console.log(`   Next proxy:`, proxy);
                    
                    if (proxy) {
                        const playwrightProxy = proxyManager.toPlaywrightFormat(proxy);
                        console.log(`   Playwright proxy format:`, playwrightProxy);
                        
                        if (playwrightProxy) {
                            launchContext.launchOptions.proxy = playwrightProxy;
                            console.log(`🌐 Using proxy: ${proxy.host}:${proxy.port}`);
                            
                            // Store proxy info for tracking
                            launchContext.userData = {
                                ...launchContext.userData,
                                proxyId: proxy.id,
                                proxyHost: proxy.host,
                                proxyPort: proxy.port
                            };
                        } else {
                            console.log(`❌ Failed to convert proxy to Playwright format`);
                        }
                    } else {
                        console.log(`❌ No proxy available from proxy manager`);
                    }
                } else {
                    console.log(`❌ Proxy is disabled in configuration`);
                }
                
                launchContext.launchOptions = {
                    ...launchContext.launchOptions,
                    args: [
                        ...launchContext.launchOptions.args || [],
                        `--user-agent=${browserFingerprint.userAgent}`,
                        `--window-size=${browserFingerprint.viewport.width},${browserFingerprint.viewport.height}`,
                        `--lang=${browserFingerprint.languages[0]}`,
                        `--timezone=${browserFingerprint.timezone}`
                    ]
                };
            }
        ]
    },
    // Add pre-navigation handler to set cookies and configure stealth
    preNavigationHooks: [
        async ({ page, request, gotoOptions }) => {
            // Configure stealth page
            await configureStealthPage(page, browserFingerprint);
            
            // Set viewport size for consistent rendering
            await page.setViewportSize({ 
                width: CONFIG.CRAWLER.viewportWidth || browserFingerprint.viewport.width, 
                height: CONFIG.CRAWLER.viewportHeight || browserFingerprint.viewport.height 
            });
            
            // Block unnecessary resources for better performance
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                const url = route.request().url();
                
                // Block images, fonts, and stylesheets to speed up loading
                if (['image', 'font', 'stylesheet'].includes(resourceType) || 
                    url.includes('.css') || 
                    url.includes('.woff') || 
                    url.includes('.woff2') ||
                    url.includes('.png') ||
                    url.includes('.jpg') ||
                    url.includes('.jpeg') ||
                    url.includes('.gif') ||
                    url.includes('.svg')) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            
            // Set navigation options for faster loading
            gotoOptions.waitUntil = 'domcontentloaded'; // Faster than 'load'
            gotoOptions.timeout = CONFIG.CRAWLER.timeout;
            
            // Set cookies before navigation if we have any
            if (playwrightCookies.length > 0) {
                try {
                    await page.context().addCookies(playwrightCookies);
                } catch (error) {
                    // Silently handle cookie setting errors
                }
            }
            
            // Add random delay before navigation
            const delay = getHumanLikeDelay(50, 0.1);
            await page.waitForTimeout(delay);
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
    // Timeout configurations
    requestHandlerTimeoutSecs: CONFIG.PROXY.maxRequestTimeout * 1000, // Use maxRequestTimeout from input
    navigationTimeoutSecs: CONFIG.PROXY.maxRequestTimeout, // Use maxRequestTimeout from input
    
    // Concurrency settings for better performance control
    minConcurrency: CONFIG.CRAWLER.minConcurrency || 1,
    maxConcurrency: CONFIG.CRAWLER.maxConcurrency || 1,
    
    // Request rate limiting to avoid overwhelming the target site
    maxRequestsPerMinute: CONFIG.CRAWLER.maxRequestsPerMinute || 60,
    
    // Autoscaled pool configuration for dynamic concurrency adjustment
    autoscaledPoolOptions: {
        scaleUpStepRatio: CONFIG.CRAWLER.scaleUpStepRatio || 0.1,
        scaleDownStepRatio: CONFIG.CRAWLER.scaleDownStepRatio || 0.1,
        autoscaleIntervalSecs: CONFIG.CRAWLER.autoscaleIntervalSecs || 10,
        desiredConcurrencyRatio: CONFIG.CRAWLER.desiredConcurrencyRatio || 0.9,
        systemStatusOptions: {
            maxEventLoopDelay: CONFIG.CRAWLER.maxEventLoopDelay || 50,
            maxMemoryRatio: CONFIG.CRAWLER.maxMemoryRatio || 0.7,
            maxCpuRatio: CONFIG.CRAWLER.maxCpuRatio || 0.7,
            maxClientErrors: CONFIG.CRAWLER.maxClientErrors || 10
        }
    },
    // Enable retry on blocked requests
    retryOnBlocked: true,
    // Handle failed requests with retry logic
    failedRequestHandler: async ({ request, error }) => {
        console.log(`❌ Failed: ${request.url}`);
        
        // Handle proxy failures if proxy is enabled
        if (CONFIG.PROXY.enabled && error.message.includes('proxy')) {
            // Extract proxy info from error or request context
            const proxyId = request.userData?.proxyId;
            if (proxyId) {
                proxyManager.markProxyFailed(proxyId);
                console.log(`🚫 Marked proxy as failed: ${proxyId}`);
            }
        }
    },
    // Increase max retries but with specific conditions
    maxRequestRetries: CONFIG.PROXY.maxFailures,
    requestHandler: async ({ page, request, enqueueLinks }) => {
        const startTime = Date.now();
        console.log(`\n🔍 Processing: ${request.url}`);
        
        // Track proxy success if proxy is enabled
        if (CONFIG.PROXY.enabled && request.userData?.proxyId) {
            proxyManager.markProxySuccess(request.userData.proxyId);
        }
        
        // Check for bot protection
        const isBotDetected = await detectBotProtection(page);
        if (isBotDetected) {
            console.log(`🛡️ Bot detection detected, implementing countermeasures...`);
            await handleBotDetection(page);
        }
        
        // Simulate human interaction
        await simulateHumanInteraction(page);
        
        // Add human-like delay
        const delay = getHumanLikeDelay(100, 0.2);
        await page.waitForTimeout(delay);
        
        
        // Temporarily disable URL filtering for debugging
        // if (!shouldCrawlUrl(request.url, CONFIG.SITE)) {
        //     console.log(`Skipping URL outside allowed patterns: ${request.url}`);
        //     return;
        // }
        
        // Handle all processing on the main specialists listing page
        {
            let currentPage = 1;
            let hasMorePages = true;
            let totalDoctorsProcessed = 0;
            let consecutiveFailures = 0;
            const maxConsecutiveFailures = 5;
            
            while (hasMorePages) {
                
                try {
                    await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                    
                    const doctorLinks = await page.evaluate((selector) => {
                        const links = Array.from(document.querySelectorAll(selector));
                        return links.map(link => ({
                            url: link.href,
                            text: link.textContent.trim()
                        }));
                    }, CONFIG.SELECTORS.specialistLinks);
                    
                    
                     for (let i = 0; i < doctorLinks.length; i++) {
                        const doctor = doctorLinks[i];
                        
                        console.log(`\n${i + 1}/${doctorLinks.length}: ${doctor.url}`);
                        
                        if (processedUrls.has(doctor.url)) {
                            console.log(`⏭️ Already processed`);
                            continue;
                        }
                        
                        if (!doctor.url || doctor.url.trim() === '' || 
                            doctor.url.includes('javascript:') || 
                            doctor.url.includes('#') ||
                            doctor.url.toLowerCase().includes('mailto:') ||
                            doctor.url.toLowerCase().includes('tel:') ||
                            !doctor.url.startsWith('http')) {
                            continue;
                        }
                        
                        processedUrls.add(doctor.url);
                        
                        if (i > 0 || currentPage > 1) {
                            // Human-like delay between links
                            const linkDelay = getHumanLikeDelay(CONFIG.CRAWLER.delayBetweenLinks, 0.1);
                            await page.waitForTimeout(linkDelay);
                        }
                        
                        let doctorPage = null;
                        try {
                            // Human-like delay before navigation
                            const navDelay = getHumanLikeDelay(CONFIG.CRAWLER.delayBeforeNavigation, 0.1);
                            await page.waitForTimeout(navDelay);
                            
                            doctorPage = await page.context().newPage();
                            
                            // Configure stealth for new page
                            await configureStealthPage(doctorPage, browserFingerprint);
                            
                            try {
                                await doctorPage.goto(doctor.url, { 
                                    waitUntil: 'domcontentloaded',
                                    timeout: 20000
                                });
                            } catch (navigationError) {
                                try {
                                    await doctorPage.goto(doctor.url, { 
                                        waitUntil: 'load',
                                        timeout: 15000
                                    });
                                    await doctorPage.waitForTimeout(1000);
                                } catch (fallbackError) {
                                    throw fallbackError;
                                }
                            }
                            
                            const currentUrl = doctorPage.url();
                            if (currentUrl !== doctor.url && 
                                (currentUrl.includes('error') || 
                                 currentUrl.includes('404') || 
                                 currentUrl.includes('access-denied') ||
                                 !currentUrl.includes('farrerpark.com'))) {
                                throw new Error('Redirected to invalid page');
                            }
                            
                            // Human-like delay after page load
                            const loadDelay = getHumanLikeDelay(CONFIG.CRAWLER.delayAfterPageLoad, 0.1);
                            await doctorPage.waitForTimeout(loadDelay);
                            
                            // Simulate human interaction on the page
                            await simulateHumanInteraction(doctorPage);
                            
                            const extractionTimeout = 30000;
                            let doctorData = null;
                            
                            try {
                                doctorData = await Promise.race([
                                    extractSpecialistData(doctorPage, doctor.url, CONFIG),
                                    new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Extraction timeout')), extractionTimeout)
                                    )
                                ]);
                            } catch (extractionError) {
                                doctorData = null;
                            }
                            
                            if (doctorData) {
                                extractedData.push(doctorData);
                                totalDoctorsProcessed++;
                                consecutiveFailures = 0;
                                console.log(`✅ Saved (${totalDoctorsProcessed} total)`);
                                
                                // Show body preview
                                const bodyPreview = await doctorPage.evaluate(() => {
                                    return document.body.textContent.trim().substring(0, 200).replace(/\s+/g, ' ');
                                });
                            } else {
                                consecutiveFailures++;
                                
                                if (consecutiveFailures >= maxConsecutiveFailures) {
                                    hasMorePages = false;
                                    break;
                                }
                            }
                            
                        } catch (error) {
                            consecutiveFailures++;
                            
                            if (consecutiveFailures >= maxConsecutiveFailures) {
                                hasMorePages = false;
                                break;
                            }
                        } finally {
                            if (doctorPage && !doctorPage.isClosed()) {
                                await doctorPage.close();
                            }
                            // Human-like delay after processing each doctor
                            const processingDelay = getHumanLikeDelay(50, 0.1);
                            await page.waitForTimeout(processingDelay);
                        }
                    }
                    
                     if (CONFIG.SITE.pagination.type === 'ajax') {
                        hasMorePages = await handleAjaxPagination(page, CONFIG);
                        
                        if (hasMorePages) {
                            currentPage++;
                            console.log(`\n➡️ Next page: ${currentPage}`);
                            // Human-like delay for pagination
                            const paginationDelay = getHumanLikeDelay(CONFIG.CRAWLER.ajaxPaginationDelay, 0.1);
                            await page.waitForTimeout(paginationDelay);
                        } else {
                            console.log(`\n🏁 No more pages`);
                        }
                    } else {
                        hasMorePages = await handleInitialPagination(page, enqueueLinks, CONFIG);
                        if (hasMorePages) {
                            currentPage++;
                            console.log(`\n➡️ Next page: ${currentPage}`);
                        } else {
                            console.log(`\n🏁 No more pages`);
                        }
                    }
                    
                } catch (error) {
                    console.log(`❌ Page ${currentPage} error: ${error.message.substring(0, 100)}`);
                    hasMorePages = false;
                }
            }
            
            console.log(`\n🎉 Completed: ${currentPage} pages, ${totalDoctorsProcessed} doctors saved, ${extractedData.length} records`);
        }
    },
    // No maxRequestsPerCrawl - unlimited crawling
    headless: CONFIG.CRAWLER.headless,
});

await crawler.run([CONFIG.SITE.startUrl]);

// Log proxy statistics if proxy is enabled
if (CONFIG.PROXY.enabled) {
    const proxyStats = proxyManager.getStats();
    console.log(`\n📊 Proxy Statistics:`);
    console.log(`   Total proxies: ${proxyStats.total}`);
    console.log(`   Available proxies: ${proxyStats.available}`);
    console.log(`   Failed proxies: ${proxyStats.failed}`);
    console.log(`   Average success rate: ${(proxyStats.successRate * 100).toFixed(1)}%`);
    console.log(`   Rotations used: ${proxyStats.rotationCount}/${proxyStats.maxRotationPerSession}`);
    console.log(`   Max request timeout: ${proxyStats.maxRequestTimeout}s`);
}

// Save extracted data to JSON file
const outputPath = await saveDataToFile(extractedData, CONFIG, CONFIG.COOKIES);

// Handle data output based on environment
await handleDataOutput(extractedData, CONFIG, Actor, isApify, CONFIG.COOKIES);

// Crawling completed silently

// Handle exit based on environment
await handleExit(Actor, isApify);