#!/usr/bin/env node

/**
 * Comprehensive Pagination Test
 * Tests the fixed pagination logic to ensure it reaches page 11 and gets all 1100 items
 */

import { chromium } from 'playwright';
import { LOCAL_CONFIG } from './src/config/local-config.js';

console.log('🚀 Starting comprehensive pagination test...');
console.log('📋 This test will check pagination through ALL pages to verify the fix');

// Test configuration - using actual config but with limited processing
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
        headless: true, // Keep headless for faster testing
        timeout: LOCAL_CONFIG.timeout
    }
};

console.log('📋 Configuration:');
console.log(`Start URL: ${TEST_CONFIG.SITE.startUrl}`);
console.log(`Specialist Links Selector: ${TEST_CONFIG.SELECTORS.specialistLinks}`);
console.log('');

let totalEntitiesFound = 0;
let pagesProcessed = 0;
const entitiesPerPage = [];

async function testPaginationLogic() {
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= 15) { // Test up to 15 pages to be safe
        console.log(`\n📄 Testing page ${currentPage}...`);
        
        try {
            // Construct page URL using the same logic as the fixed main.js
            let currentPageUrl;
            if (currentPage === 1) {
                currentPageUrl = TEST_CONFIG.SITE.startUrl;
            } else {
                // Use the same URL construction logic as the fix
                const baseUrlWithoutPage = TEST_CONFIG.SITE.startUrl.replace(/[?&]page=\d+/, '');
                const separator = baseUrlWithoutPage.includes('?') ? '&' : '?';
                currentPageUrl = `${baseUrlWithoutPage}${separator}page=${currentPage}`;
            }
            
            console.log(`🌐 Page URL: ${currentPageUrl}`);
            
            // Test page with fresh browser
            const browser = await chromium.launch({
                headless: TEST_CONFIG.CRAWLER.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });
            
            const page = await browser.newPage();
            page.setDefaultTimeout(TEST_CONFIG.CRAWLER.timeout);
            
            // Navigate to page
            await page.goto(currentPageUrl, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000); // Wait for page to stabilize
            
            // Try to find entity links
            let entityCount = 0;
            try {
                await page.waitForSelector(TEST_CONFIG.SELECTORS.specialistLinks, { timeout: 15000 });
                
                entityCount = await page.evaluate((selector) => {
                    const links = document.querySelectorAll(selector);
                    console.log(`Found ${links.length} entity links on this page`);
                    
                    // Log some debug info
                    console.log(`Page title: ${document.title}`);
                    console.log(`Page URL: ${window.location.href}`);
                    
                    // Check for end-of-results indicators
                    const noResults = document.querySelector('.alert, .no-results, .empty');
                    if (noResults) {
                        console.log(`No results indicator: ${noResults.textContent}`);
                    }
                    
                    // Check page info text
                    const pageInfo = document.body.textContent;
                    if (pageInfo.includes('Page ') && pageInfo.includes(' of ')) {
                        const pageMatch = pageInfo.match(/Page (\d+) of (\d+)/);
                        if (pageMatch) {
                            console.log(`Page info: Page ${pageMatch[1]} of ${pageMatch[2]}`);
                        }
                    }
                    
                    return links.length;
                }, TEST_CONFIG.SELECTORS.specialistLinks);
                
                console.log(`✅ Found ${entityCount} entities on page ${currentPage}`);
                
            } catch (error) {
                console.log(`❌ Could not find entities on page ${currentPage}: ${error.message}`);
                entityCount = 0;
            }
            
            await browser.close();
            
            if (entityCount > 0) {
                pagesProcessed++;
                totalEntitiesFound += entityCount;
                entitiesPerPage.push({ page: currentPage, entities: entityCount });
                
                console.log(`📊 Page ${currentPage}: ${entityCount} entities (Total so far: ${totalEntitiesFound})`);
                currentPage++;
                
                // Add delay between pages
                console.log('⏳ Waiting 3 seconds before next page...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.log(`📄 No entities found on page ${currentPage} - reached end of pagination`);
                hasMorePages = false;
            }
            
        } catch (error) {
            console.log(`❌ Error testing page ${currentPage}: ${error.message}`);
            hasMorePages = false;
        }
    }
    
    return { pagesProcessed, totalEntitiesFound, entitiesPerPage };
}

// Run the test
try {
    const results = await testPaginationLogic();
    
    console.log('\n🎯 PAGINATION TEST RESULTS:');
    console.log('='.repeat(50));
    console.log(`📄 Pages successfully processed: ${results.pagesProcessed}`);
    console.log(`📊 Total entities found: ${results.totalEntitiesFound}`);
    console.log('');
    
    console.log('📋 Entities per page:');
    results.entitiesPerPage.forEach(({ page, entities }) => {
        console.log(`   Page ${page}: ${entities} entities`);
    });
    
    console.log('');
    console.log('📈 ANALYSIS:');
    
    if (results.pagesProcessed >= 11) {
        console.log('✅ SUCCESS: Pagination reached 11+ pages as expected!');
    } else {
        console.log(`⚠️  WARNING: Only reached ${results.pagesProcessed} pages (expected 11)`);
    }
    
    if (results.totalEntitiesFound >= 1000) {
        console.log('✅ SUCCESS: Found 1000+ entities as expected!');
    } else {
        console.log(`⚠️  WARNING: Only found ${results.totalEntitiesFound} entities (expected ~1100)`);
    }
    
    // Calculate average entities per page
    const avgEntitiesPerPage = Math.round(results.totalEntitiesFound / results.pagesProcessed);
    console.log(`📊 Average entities per page: ${avgEntitiesPerPage}`);
    
    if (avgEntitiesPerPage >= 80 && avgEntitiesPerPage <= 120) {
        console.log('✅ SUCCESS: Average entities per page is within expected range (80-120)');
    } else {
        console.log(`⚠️  WARNING: Average entities per page (${avgEntitiesPerPage}) is outside expected range`);
    }
    
    console.log('\n🎉 Test completed!');
    
} catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
}
