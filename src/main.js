import { PlaywrightCrawler } from 'crawlee';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination } from './handlers/paginationHandler.js';
import { shouldCrawlUrl } from './utils/helpers.js';
import { 
    waitForManualIntervention,
    checkForManualIntervention,
    pauseForManualInteraction
} from './utils/manualMode.js';
import { runManualCrawler } from './manual-crawler.js';
import { runScraperOnly } from './scraper-only.js';
import { 
    getConfiguration, 
    handleDataOutput, 
    handleExit 
} from './config/environment.js';

// Get configuration based on environment (Apify or local)
const { input, isApify, Actor } = await getConfiguration();

// Validate required input fields
const requiredFields = {
    'headless': 'Headless Mode',
};

const missingFields = [];
for (const [fieldKey, fieldName] of Object.entries(requiredFields)) {
    if (input[fieldKey] === undefined || input[fieldKey] === null || input[fieldKey] === '') {
        missingFields.push(fieldName);
    }
}

// Special validation for arrays
if (input.allowedUrlPatterns && input.allowedUrlPatterns.length === 0) {
    missingFields.push('Allowed URL Patterns (must contain at least one pattern)');
}

// Conditional required fields based on pagination type
if (input.paginationType === 'query' && (!input.queryPattern || input.queryPattern.trim() === '')) {
    missingFields.push('Query Pattern (required when Pagination Type is "query")');
}
if (input.paginationType === 'path' && (!input.pathPattern || input.pathPattern.trim() === '')) {
    missingFields.push('Path Pattern (required when Pagination Type is "path")');
}

if (missingFields.length > 0) {
    const errorMessage = `❌ CONFIGURATION ERROR: The following required fields are missing or empty:\n\n${missingFields.map(field => `• ${field}`).join('\n')}\n\n⚠️  All fields marked as required in the input schema must be filled out. Please provide values for all missing fields and try again.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
}

// Create configuration object from input (no fallbacks)
const CONFIG = {
    SITE: {
        name: input.siteName,
        baseUrl: input.baseUrl,
        startUrl: input.startUrl,
        allowedUrlPatterns: input.allowedUrlPatterns,
        excludedUrlPatterns: input.excludedUrlPatterns || [],
        pagination: {
            type: input.paginationType,
            queryPattern: input.queryPattern || 'page={page}',
            pathPattern: input.pathPattern || '/page/{page}/',
            baseUrl: input.paginationBaseUrl || null,
            startPage: input.startPage || 1
        }
    },
    SELECTORS: {
        specialistLinks: input.specialistLinksSelector,
        nextButton: input.nextButtonSelector,
        nextButtonContainer: input.nextButtonContainerSelector,
        doctorName: input.doctorNameSelector,
        contactLinks: input.contactLinksSelector
    },
    CRAWLER: {
        maxRequestsPerCrawl: input.maxRequestsPerCrawl,
        headless: input.headless,
        timeout: input.timeout,
        manualMode: input.manualMode || false,
        scraperMode: input.scraperMode || false,
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
    },
    SCRAPER: {
        urls: input.scraperUrls || [],
        customSelectors: input.customSelectors || {}
    },
    OUTPUT: {
        getFilename: () => {
            if (input.outputFilename && input.outputFilename.trim() !== '') {
                return input.outputFilename.endsWith('.json') ? input.outputFilename : `${input.outputFilename}.json`;
            }
            const today = new Date().toISOString().split('T')[0];
            return `memc-specialists-${today}.json`;
        }
    },
};

console.log('Starting crawler with configuration:', {
    environment: isApify ? 'Apify' : 'Local',
    siteName: CONFIG.SITE.name,
    headless: CONFIG.CRAWLER.headless,
});

// Check for scraper-only mode first
if (CONFIG.CRAWLER.scraperMode) {
    console.log('🎯 Scraper-only mode enabled - scraping specific URLs');
    
    if (!CONFIG.SCRAPER.urls || CONFIG.SCRAPER.urls.length === 0) {
        const errorMessage = '❌ SCRAPER MODE ERROR: No URLs provided for scraping. Please add URLs to the scraperUrls array in your configuration.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    
    console.log(`📋 URLs to scrape: ${CONFIG.SCRAPER.urls.length}`);
    CONFIG.SCRAPER.urls.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
    });
    
    const extractedData = await runScraperOnly(CONFIG);
    
    // Handle data output based on environment
    await handleDataOutput(extractedData, CONFIG, Actor, isApify);
    
    console.log(`✅ Scraper-only mode completed! Processed ${extractedData.length} URLs.`);
    
    // Handle exit based on environment
    await handleExit(Actor, isApify);
    // Exit here to avoid running the regular crawler
    process.exit(0);
}

// If manual mode is enabled, use the manual crawler instead
if (CONFIG.CRAWLER.manualMode) {
    console.log('🎮 Manual mode enabled - using manual crawler');
    const extractedData = await runManualCrawler(CONFIG);
    
    // Handle data output based on environment
    await handleDataOutput(extractedData, CONFIG, Actor, isApify);
    
    console.log(`✅ Manual crawling completed! Found ${extractedData.length} specialists.`);
    
    // Handle exit based on environment
    await handleExit(Actor, isApify);
    // Exit here to avoid running the regular crawler
    process.exit(0);
}

// Array to store all extracted data (for regular crawler)
let extractedData = [];

// Create backup of existing file if needed
createBackupIfExists(CONFIG.OUTPUT.getFilename(), CONFIG);

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: CONFIG.CRAWLER.headless,
            ignoreHTTPSErrors: true
        }
    },
    // Session pool options
    sessionPoolOptions: {
        blockedStatusCodes: [], // Don't auto-block any status codes (including 403, 503)
        maxPoolSize: 1, // Single session for manual mode
        sessionOptions: {
            maxErrorScore: 10, // Higher tolerance for "errors" 
            errorScoreDecrement: 0.5, // Slower error recovery
        }
    },
    // Add delays between requests to avoid being detected as a bot
    requestHandlerTimeoutSecs: 120, // Increased for manual mode
    navigationTimeoutSecs: 60, // Increased for manual mode
    // Add random delays between requests
    minConcurrency: 1,
    maxConcurrency: 1,
    // Handle failed requests differently in manual mode
    failedRequestHandler: async ({ request, error }) => {
        if (CONFIG.CRAWLER.manualMode) {
            console.log(`🚨 Request failed in manual mode: ${request.url}`);
            console.log(`📝 Error: ${error.message}`);
            console.log(`🔄 Attempting manual intervention...`);
            
            // Instead of failing, we'll try to handle this manually
            // Create a new browser page and navigate directly
            const browser = await request.userData?.browser;
            if (browser) {
                try {
                    const context = await browser.newContext();
                    const page = await context.newPage();
                    
                    console.log(`🌐 Opening page manually for: ${request.url}`);
                    await page.goto(request.url, { 
                        waitUntil: 'domcontentloaded',
                        timeout: CONFIG.CRAWLER.timeout 
                    });
                    
                    // Now trigger manual intervention
                    const needsIntervention = await checkForManualIntervention(page);
                    if (needsIntervention) {
                        await waitForManualIntervention(page, request.url, 'Request failed with 403 - manual handling required');
                    }
                    
                    await context.close();
                    return; // Don't throw error
                } catch (manualError) {
                    console.log(`❌ Manual handling also failed: ${manualError.message}`);
                }
            }
        }
        
        // For non-manual mode or if manual handling fails, throw the original error
        console.error(`❌ Request failed: ${error.message}`);
    },
    requestHandler: async ({ page, request, enqueueLinks }) => {
        // Add random delay between 2-5 seconds to mimic human behavior
        const delay = Math.random() * 3000 + 2000;
        console.log(`⏱️ Waiting ${Math.round(delay)}ms before processing request`);
        await page.waitForTimeout(delay);
        console.log(`Processing: ${request.url}`);
        
        // Handle challenges based on mode
        if (CONFIG.CRAWLER.manualMode) {
            console.log('👤 Manual mode enabled - checking if intervention is needed');
            const needsIntervention = await checkForManualIntervention(page);
            if (needsIntervention) {
                await waitForManualIntervention(page, request.url, 'Challenge or blocking detected');
            } else {
                // Still pause briefly to let you see what's happening
                console.log('✅ No challenges detected, continuing...');
                await page.waitForTimeout(2000);
            }
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
    maxRequestsPerCrawl: CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
});

await crawler.run([CONFIG.SITE.startUrl]);

// Save extracted data to JSON file
const outputPath = await saveDataToFile(extractedData, CONFIG);

// Handle data output based on environment
await handleDataOutput(extractedData, CONFIG, Actor, isApify);

console.log(`✅ Crawling completed! Found ${extractedData.length} specialists.`);
console.log(`📁 Data saved to: ${outputPath}`);

// Handle exit based on environment
await handleExit(Actor, isApify);