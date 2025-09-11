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
        console.error(`❌ Request failed for URL: ${request.url}`);
        console.error(`🔍 Error details:`, error.message);
        console.error(`🔄 Retry count: ${request.retryCount}`);
        console.error(`⏰ Failed at: ${new Date().toISOString()}`);
    },
    // Increase max retries but with specific conditions
    maxRequestRetries: 2,
    requestHandler: async ({ page, request, enqueueLinks }) => {
        const startTime = Date.now();
        console.log(`🚀 Starting request handler for: ${request.url}`);
        console.log(`⏰ Request started at: ${new Date().toISOString()}`);
        
        // Add random delay between 2-5 seconds to mimic human behavior
        const delay = Math.random() * 3000 + 2000;
        console.log(`⏳ Adding random delay of ${Math.round(delay)}ms to mimic human behavior`);
        await page.waitForTimeout(delay);
        
        
        // Temporarily disable URL filtering for debugging
        // if (!shouldCrawlUrl(request.url, CONFIG.SITE)) {
        //     console.log(`Skipping URL outside allowed patterns: ${request.url}`);
        //     return;
        // }
        
        // Handle all processing on the main specialists listing page
        {
            // This is the initial page load - handle AJAX pagination efficiently
            
            console.log("🔍 Starting extraction process...");
            console.log(`📊 Current processed URLs count: ${processedUrls.size}`);
            console.log(`📊 Current extracted data count: ${extractedData.length}`);
            
            let currentPage = 1;
            let hasMorePages = true;
            let totalDoctorsProcessed = 0;
            let consecutiveFailures = 0;
            const maxConsecutiveFailures = 5; // Stop after 5 consecutive failures
            
            while (hasMorePages) {
                const pageStartTime = Date.now();
                console.log(`\n📄 Processing page ${currentPage}...`);
                
                try {
                    // Wait for the specialists content to load
                    console.log(`⏳ Waiting for specialist links selector: ${CONFIG.SELECTORS.specialistLinks}`);
                    await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                    console.log(`✅ Specialist links selector found after ${Date.now() - pageStartTime}ms`);
                    
                    // Get all doctor links on current page
                    console.log(`🔍 Extracting doctor links from page ${currentPage}...`);
                    const doctorLinks = await page.evaluate((selector) => {
                        const links = Array.from(document.querySelectorAll(selector));
                        console.log(`Found ${links.length} doctor links on page`);
                        return links.map(link => ({
                            url: link.href,
                            text: link.textContent.trim()
                        }));
                    }, CONFIG.SELECTORS.specialistLinks);
                    
                    console.log(`📋 Found ${doctorLinks.length} doctor links on page ${currentPage}`);
                    
                    
                     // Process each doctor on this page immediately
                     console.log(`🏥 Starting to process ${doctorLinks.length} doctors on page ${currentPage}...`);
                     for (let i = 0; i < doctorLinks.length; i++) {
                        const doctorStartTime = Date.now();
                        const doctor = doctorLinks[i];
                        
                        console.log(`\n👨‍⚕️ Processing doctor ${i + 1}/${doctorLinks.length}: ${doctor.text}`);
                        console.log(`🔗 Doctor URL: ${doctor.url}`);
                        
                        // Skip if we've already processed this URL
                        if (processedUrls.has(doctor.url)) {
                            console.log(`⏭️  Skipping already processed URL: ${doctor.url}`);
                            continue;
                        }
                        
                        // Validate URL before processing
                        if (!doctor.url || doctor.url.trim() === '' || 
                            doctor.url.includes('javascript:') || 
                            doctor.url.includes('#') ||
                            doctor.url.toLowerCase().includes('mailto:') ||
                            doctor.url.toLowerCase().includes('tel:') ||
                            !doctor.url.startsWith('http')) {
                            console.log(`⏭️  Skipping invalid URL: ${doctor.url}`);
                            continue;
                        }
                        
                        // Add URL to processed set
                        processedUrls.add(doctor.url);
                        console.log(`✅ Added URL to processed set (total processed: ${processedUrls.size})`);
                        
                        
                        // Add delay before processing each doctor link to avoid overwhelming the server
                        if (i > 0 || currentPage > 1) { // Skip delay for the very first doctor
                            console.log(`⏳ Adding delay of ${CONFIG.CRAWLER.delayBetweenLinks}ms between doctor links`);
                            await page.waitForTimeout(CONFIG.CRAWLER.delayBetweenLinks);
                        }
                        
                        let doctorPage = null;
                        try {
                            // Add delay before navigation to avoid overwhelming the server
                            console.log(`⏳ Adding pre-navigation delay of ${CONFIG.CRAWLER.delayBeforeNavigation}ms`);
                            await page.waitForTimeout(CONFIG.CRAWLER.delayBeforeNavigation);
                            
                            // Open doctor detail page in new tab
                            console.log(`🆕 Opening new page for doctor details`);
                            const newPageStartTime = Date.now();
                            doctorPage = await page.context().newPage();
                            console.log(`✅ New page created in ${Date.now() - newPageStartTime}ms`);
                            
                            // Set longer timeout for navigation with better error handling
                            console.log(`🌐 Navigating to doctor page: ${doctor.url}`);
                            const navigationStartTime = Date.now();
                            
                            try {
                                await doctorPage.goto(doctor.url, { 
                                    waitUntil: 'networkidle',
                                    timeout: 45000 // Reduced from 60s to 45s for faster failure detection
                                });
                                console.log(`✅ Navigation completed in ${Date.now() - navigationStartTime}ms`);
                            } catch (navigationError) {
                                console.error(`❌ Navigation failed for ${doctor.url}: ${navigationError.message}`);
                                console.log(`⏱️  Navigation failed after ${Date.now() - navigationStartTime}ms`);
                                
                                // Try a simpler navigation approach as fallback
                                console.log(`🔄 Trying fallback navigation without networkidle...`);
                                const fallbackStartTime = Date.now();
                                try {
                                    await doctorPage.goto(doctor.url, { 
                                        waitUntil: 'domcontentloaded',
                                        timeout: 30000
                                    });
                                    console.log(`✅ Fallback navigation completed in ${Date.now() - fallbackStartTime}ms`);
                                    // Add extra wait for dynamic content
                                    await doctorPage.waitForTimeout(3000);
                                } catch (fallbackError) {
                                    console.error(`❌ Fallback navigation also failed: ${fallbackError.message}`);
                                    throw fallbackError; // Re-throw to skip this doctor
                                }
                            }
                            
                            // Check if we got redirected or if the page content is suspicious
                            const currentUrl = doctorPage.url();
                            if (currentUrl !== doctor.url) {
                                console.log(`🔄 Page redirected from ${doctor.url} to ${currentUrl}`);
                                
                                // Check if redirect is to an error page or unwanted destination
                                if (currentUrl.includes('error') || 
                                    currentUrl.includes('404') || 
                                    currentUrl.includes('access-denied') ||
                                    !currentUrl.includes('farrerpark.com')) {
                                    console.log(`❌ Redirected to invalid page, skipping: ${currentUrl}`);
                                    throw new Error('Redirected to invalid page');
                                }
                            }
                            
                            // Wait for page to be fully stable after load
                            console.log(`⏳ Waiting ${CONFIG.CRAWLER.delayAfterPageLoad}ms for page stability`);
                            await doctorPage.waitForTimeout(CONFIG.CRAWLER.delayAfterPageLoad);
                            
                            // Extract doctor data with timeout protection
                            console.log(`🔍 Starting data extraction for: ${doctor.text}`);
                            const extractionStartTime = Date.now();
                            
                            // Set a timeout for the entire extraction process
                            const extractionTimeout = 30000; // 30 seconds max for extraction
                            let doctorData = null;
                            
                            try {
                                doctorData = await Promise.race([
                                    extractSpecialistData(doctorPage, doctor.url, CONFIG),
                                    new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Extraction timeout')), extractionTimeout)
                                    )
                                ]);
                                console.log(`✅ Data extraction completed in ${Date.now() - extractionStartTime}ms`);
                            } catch (extractionError) {
                                if (extractionError.message === 'Extraction timeout') {
                                    console.error(`⏰ Data extraction timed out after ${extractionTimeout}ms for: ${doctor.text}`);
                                } else {
                                    console.error(`❌ Data extraction failed for ${doctor.text}: ${extractionError.message}`);
                                }
                                console.log(`⏱️  Extraction failed after ${Date.now() - extractionStartTime}ms`);
                                doctorData = null;
                            }
                            
                            // Only add valid data and increment counter for valid records
                            if (doctorData) {
                                extractedData.push(doctorData);
                                totalDoctorsProcessed++;
                                consecutiveFailures = 0; // Reset failure counter on success
                                console.log(`✅ Doctor data saved! Total processed: ${totalDoctorsProcessed}`);
                                console.log(`📊 Current extracted data count: ${extractedData.length}`);
                            } else {
                                consecutiveFailures++;
                                console.log(`❌ No valid doctor data extracted for: ${doctor.text}`);
                                console.log(`⚠️  Consecutive failures: ${consecutiveFailures}/${maxConsecutiveFailures}`);
                                
                                if (consecutiveFailures >= maxConsecutiveFailures) {
                                    console.error(`🛑 Circuit breaker triggered! ${maxConsecutiveFailures} consecutive failures. Stopping to prevent infinite loops.`);
                                    hasMorePages = false;
                                    break; // Break out of the doctor processing loop
                                }
                            }
                            
                        } catch (error) {
                            consecutiveFailures++;
                            console.error(`❌ Error processing doctor ${doctor.text} (${doctor.url}):`, error.message);
                            console.error(`🔍 Error details:`, error.stack);
                            console.log(`⚠️  Consecutive failures: ${consecutiveFailures}/${maxConsecutiveFailures}`);
                            
                            if (consecutiveFailures >= maxConsecutiveFailures) {
                                console.error(`🛑 Circuit breaker triggered! ${maxConsecutiveFailures} consecutive failures. Stopping to prevent infinite loops.`);
                                hasMorePages = false;
                                break; // Break out of the doctor processing loop
                            }
                        } finally {
                            // Always close the doctor page in finally block
                            if (doctorPage && !doctorPage.isClosed()) {
                                try {
                                    console.log(`🔒 Closing doctor page`);
                                    await doctorPage.close();
                                    console.log(`✅ Doctor page closed successfully`);
                                } catch (closeError) {
                                    console.error(`❌ Error closing doctor page:`, closeError.message);
                                }
                            }
                            
                            // Additional small delay after processing
                            try {
                                console.log(`⏳ Adding 1.5s delay after processing doctor`);
                                await page.waitForTimeout(1500);
                            } catch (timeoutError) {
                                console.error(`❌ Error during post-processing timeout:`, timeoutError.message);
                            }
                            
                            const doctorProcessTime = Date.now() - doctorStartTime;
                            console.log(`⏱️  Doctor ${i + 1} processed in ${doctorProcessTime}ms (${Math.round(doctorProcessTime/1000)}s)`);
                        }
                    }
                    
                     // After processing all doctors on current page, check if we should continue to next page
                     console.log(`\n📄 Finished processing all ${doctorLinks.length} doctors on page ${currentPage}`);
                     const pageProcessTime = Date.now() - pageStartTime;
                     console.log(`⏱️  Page ${currentPage} processed in ${pageProcessTime}ms (${Math.round(pageProcessTime/1000)}s)`);
                     
                     if (CONFIG.SITE.pagination.type === 'ajax') {
                        console.log(`🔄 Checking for next page using AJAX pagination...`);
                        const paginationStartTime = Date.now();
                        hasMorePages = await handleAjaxPagination(page, CONFIG);
                        console.log(`✅ Pagination check completed in ${Date.now() - paginationStartTime}ms`);
                        
                        if (hasMorePages) {
                            currentPage++;
                            console.log(`➡️  Moving to page ${currentPage}`);
                            // Extended delay to ensure page is fully loaded and stable
                            console.log(`⏳ Adding AJAX pagination delay of ${CONFIG.CRAWLER.ajaxPaginationDelay}ms`);
                            await page.waitForTimeout(CONFIG.CRAWLER.ajaxPaginationDelay);
                        } else {
                            console.log(`🏁 No more pages available. Pagination complete.`);
                        }
                    } else {
                        console.log(`🔄 Checking for next page using traditional pagination...`);
                        // Fallback to traditional pagination if not AJAX
                        hasMorePages = await handleInitialPagination(page, enqueueLinks, CONFIG);
                        if (hasMorePages) {
                            currentPage++;
                            console.log(`➡️  Moving to page ${currentPage}`);
                        } else {
                            console.log(`🏁 No more pages available. Pagination complete.`);
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing page ${currentPage}:`, error.message);
                    console.error(`🔍 Error stack:`, error.stack);
                    
                    if (error.message.includes('Target page, context or browser has been closed')) {
                        console.log(`🛑 Browser/context closed. Stopping pagination.`);
                        hasMorePages = false; // Stop if browser/context is closed
                    } else if (error.message.includes('Timeout')) {
                        console.log(`⏰ Timeout error on page ${currentPage}. Stopping for safety.`);
                        hasMorePages = false; // Stop on timeout errors
                    } else {
                        console.log(`🛑 Stopping pagination due to error on page ${currentPage}`);
                        hasMorePages = false; // For now, stop on any error to be safe
                    }
                }
            }
            
            const totalProcessTime = Date.now() - startTime;
            console.log(`\n🎉 Extraction process completed!`);
            console.log(`📊 Final Statistics:`);
            console.log(`   - Total pages processed: ${currentPage}`);
            console.log(`   - Total doctors processed: ${totalDoctorsProcessed}`);
            console.log(`   - Total extracted data records: ${extractedData.length}`);
            console.log(`   - Total unique URLs processed: ${processedUrls.size}`);
            console.log(`⏱️  Total processing time: ${totalProcessTime}ms (${Math.round(totalProcessTime/1000)}s)`);
            console.log(`⏰ Process completed at: ${new Date().toISOString()}`);
        }
    },
    // No maxRequestsPerCrawl - unlimited crawling
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