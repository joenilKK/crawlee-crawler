/**
 * Test script to verify pagination fixes
 * This will run a limited crawl to test if pagination is working
 */

import { PlaywrightCrawler } from 'crawlee';
import { LOCAL_CONFIG } from './src/config/local-config.js';

// Create a simple test configuration
const TEST_CONFIG = {
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
        doctorName: LOCAL_CONFIG.doctorNameSelector,
        contactLinks: LOCAL_CONFIG.contactLinksSelector
    },
    CRAWLER: {
        maxRequestsPerCrawl: 3, // Just test a few pages
        headless: false, // Keep visible for debugging
        timeout: LOCAL_CONFIG.timeout,
        labels: {
            DETAIL: 'DETAIL',
            SPECIALISTS_LIST: 'SPECIALISTS_LIST'
        }
    }
};

console.log('🧪 Starting pagination test...');
console.log('Configuration:', {
    startUrl: TEST_CONFIG.SITE.startUrl,
    maxRequests: TEST_CONFIG.CRAWLER.maxRequestsPerCrawl,
    specialistSelector: TEST_CONFIG.SELECTORS.specialistLinks,
    nextButtonSelector: TEST_CONFIG.SELECTORS.nextButton
});

let pageCount = 0;
let foundLinksCount = 0;

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: TEST_CONFIG.CRAWLER.headless,
            ignoreHTTPSErrors: true
        }
    },
    maxRequestsPerCrawl: TEST_CONFIG.CRAWLER.maxRequestsPerCrawl,
    requestHandler: async ({ page, request, enqueueLinks }) => {
        pageCount++;
        console.log(`\n📄 Processing page ${pageCount}: ${request.url}`);
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        if (request.label === TEST_CONFIG.CRAWLER.labels.SPECIALISTS_LIST) {
            console.log('🔍 This is a pagination page');
        } else {
            console.log('🏠 This is the initial page');
        }
        
        // Check if specialist links exist
        try {
            console.log(`Looking for specialist links: ${TEST_CONFIG.SELECTORS.specialistLinks}`);
            
            // Try with a longer timeout
            await page.waitForSelector(TEST_CONFIG.SELECTORS.specialistLinks, { timeout: 15000 });
            
            const linksFound = await page.evaluate((selector) => {
                return document.querySelectorAll(selector).length;
            }, TEST_CONFIG.SELECTORS.specialistLinks);
            
            foundLinksCount += linksFound;
            console.log(`✅ Found ${linksFound} specialist links on this page`);
            
            // Don't actually process the specialist links, just count them
            console.log(`📊 Total specialist links found so far: ${foundLinksCount}`);
            
        } catch (error) {
            console.log(`❌ Could not find specialist links: ${error.message}`);
            
            // Debug what's on the page
            const pageInfo = await page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    totalLinks: document.querySelectorAll('a').length
                };
            });
            console.log('Page info:', pageInfo);
        }
        
        // Check pagination
        if (pageCount === 1) {
            console.log('\n🔄 Testing pagination from initial page...');
            
            // Try to find next page
            try {
                const nextButton = await page.$(TEST_CONFIG.SELECTORS.nextButton);
                if (nextButton) {
                    console.log('✅ Next button found');
                    
                    // Generate page 2 URL manually
                    const page2Url = `${TEST_CONFIG.SITE.startUrl}page/2/`;
                    console.log(`🔗 Enqueuing page 2: ${page2Url}`);
                    
                    await enqueueLinks({
                        urls: [page2Url],
                        label: TEST_CONFIG.CRAWLER.labels.SPECIALISTS_LIST,
                    });
                } else {
                    console.log('❌ Next button not found');
                }
            } catch (error) {
                console.log(`❌ Pagination check failed: ${error.message}`);
            }
        }
        
        console.log(`✅ Page ${pageCount} processing completed\n` + '='.repeat(60));
    },
    
    failedRequestHandler: async ({ request, error }) => {
        console.error(`❌ Request failed: ${request.url} - ${error.message}`);
    }
});

console.log('\n🚀 Starting test crawl...');
await crawler.run([TEST_CONFIG.SITE.startUrl]);

console.log('\n📊 Test Results:');
console.log(`Pages processed: ${pageCount}`);
console.log(`Total specialist links found: ${foundLinksCount}`);
console.log('\n🎉 Test completed!');
