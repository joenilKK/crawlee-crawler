import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination } from './handlers/paginationHandler.js';
import { shouldCrawlUrl } from './utils/helpers.js';
import { 
    getCloudflareBypassOptions, 
    setupStealthMode, 
    setupUndetectedMode,
    handleCloudflareChallenge
} from './utils/cloudflareBypass.js';

// Initialize Apify Actor
await Actor.init();

// Get input from Apify Actor
const input = await Actor.getInput();

// Validate required input fields
const requiredFields = {
    'siteName': 'Site Name',
    'baseUrl': 'Base URL',
    'startUrl': 'Start URL',
    'allowedUrlPatterns': 'Allowed URL Patterns',
    'paginationType': 'Pagination Type',
    'specialistLinksSelector': 'Specialist Links Selector',
    'nextButtonSelector': 'Next Button Selector',
    'nextButtonContainerSelector': 'Next Button Container Selector',
    'doctorNameSelector': 'Doctor Name Selector',
    'contactLinksSelector': 'Contact Links Selector',
    'maxRequestsPerCrawl': 'Max Requests Per Crawl',
    'headless': 'Headless Mode',
    'timeout': 'Timeout'
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
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
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
    CLOUDFLARE: {
        enabled: input.cloudflareBypass || false,
        method: input.cloudflareBypassMethod || 'stealth',
        waitTime: input.cloudflareWaitTime || 10000,
        retries: input.cloudflareRetries || 3,
        userAgent: input.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

console.log('Starting crawler with configuration:', {
    siteName: CONFIG.SITE.name,
    startUrl: CONFIG.SITE.startUrl,
    maxRequests: CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
    cloudflareBypass: CONFIG.CLOUDFLARE.enabled,
    cloudflareMethod: CONFIG.CLOUDFLARE.method
});

// Array to store all extracted data
let extractedData = [];

// Create backup of existing file if needed
createBackupIfExists(CONFIG.OUTPUT.getFilename(), CONFIG);

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: getCloudflareBypassOptions(CONFIG)
    },
    browserPoolOptions: {
        useFingerprints: CONFIG.CLOUDFLARE.enabled,
    },
    requestHandler: async ({ page, request, enqueueLinks }) => {
        console.log(`Processing: ${request.url}`);
        
        // Handle Cloudflare challenges if bypass is enabled
        if (CONFIG.CLOUDFLARE.enabled) {
            console.log('🛡️ Cloudflare bypass enabled - checking for challenges');
            try {
                // Check and handle Cloudflare challenges (page is already navigated by Crawlee)
                const challengeHandled = await handleCloudflareChallenge(page, CONFIG);
                if (!challengeHandled) {
                    throw new Error('Failed to handle Cloudflare challenge');
                }
            } catch (error) {
                console.error(`❌ Failed to handle Cloudflare challenge: ${error.message}`);
                throw error;
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
    preNavigationHooks: [
        async ({ page, request }) => {
            // Setup stealth mode for browser context if Cloudflare bypass is enabled
            if (CONFIG.CLOUDFLARE.enabled) {
                console.log(`🔧 Setting up Cloudflare bypass (${CONFIG.CLOUDFLARE.method}) for: ${request.url}`);
                
                // Setup stealth mode for browser context
                await setupStealthMode(page.context(), CONFIG);
                
                // Setup undetected mode if selected
                if (CONFIG.CLOUDFLARE.method === 'undetected' || CONFIG.CLOUDFLARE.method === 'both') {
                    await setupUndetectedMode(page, CONFIG);
                }
            }
        }
    ],
    maxRequestsPerCrawl: CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
});

await crawler.run([CONFIG.SITE.startUrl]);

// Save extracted data to JSON file
const outputPath = await saveDataToFile(extractedData, CONFIG);

// Store the results in Apify dataset
await Actor.pushData({
    summary: {
        totalRecords: extractedData.length,
        siteName: CONFIG.SITE.name,
        startUrl: CONFIG.SITE.startUrl,
        extractedAt: new Date().toISOString(),
        outputFile: CONFIG.OUTPUT.getFilename()
    },
    specialists: extractedData
});

console.log(`✅ Crawling completed! Found ${extractedData.length} specialists.`);
console.log(`📁 Data saved to: ${outputPath}`);
console.log(`📊 Data also stored in Apify dataset`);

// Exit the Actor
await Actor.exit();