#!/usr/bin/env node

/**
 * Debug script to test pagination continuation from where it stopped
 * This will help us understand why it stopped at 225 entities
 */

import { chromium } from 'playwright';
import { LOCAL_CONFIG } from './src/config/local-config.js';

console.log('🔍 Debugging pagination continuation...');
console.log('📋 Testing pages 3-5 to see where the issue occurs');

const TEST_CONFIG = {
    SITE: {
        startUrl: LOCAL_CONFIG.startUrl,
    },
    SELECTORS: {
        specialistLinks: LOCAL_CONFIG.specialistLinksSelector,
    },
    CRAWLER: {
        headless: false, // Keep visible for debugging
        timeout: LOCAL_CONFIG.timeout
    }
};

async function testPageContinuation() {
    // Test pages 3, 4, and 5 specifically
    const pagesToTest = [3, 4, 5, 6];
    
    for (const pageNum of pagesToTest) {
        console.log(`\n📄 Testing page ${pageNum}...`);
        
        try {
            // Construct page URL
            const baseUrlWithoutPage = TEST_CONFIG.SITE.startUrl.replace(/[?&]page=\d+/, '');
            const separator = baseUrlWithoutPage.includes('?') ? '&' : '?';
            const pageUrl = pageNum === 1 ? 
                TEST_CONFIG.SITE.startUrl : 
                `${baseUrlWithoutPage}${separator}page=${pageNum}`;
            
            console.log(`🌐 Page URL: ${pageUrl}`);
            
            // Test page with browser
            const browser = await chromium.launch({
                headless: TEST_CONFIG.CRAWLER.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            page.setDefaultTimeout(30000);
            
            // Navigate to page
            console.log(`📡 Navigating to page ${pageNum}...`);
            await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
            
            // Wait for page to stabilize
            console.log(`⏳ Waiting for page to load...`);
            await page.waitForTimeout(5000);
            
            // Try to find entity links
            let entityCount = 0;
            let entityLinks = [];
            
            try {
                await page.waitForSelector(TEST_CONFIG.SELECTORS.specialistLinks, { timeout: 15000 });
                
                const result = await page.evaluate((selector) => {
                    const links = document.querySelectorAll(selector);
                    const linkHrefs = Array.from(links).map(link => link.href).filter(href => href);
                    
                    // Debug info
                    console.log(`Found ${links.length} entity links`);
                    console.log(`Page title: ${document.title}`);
                    console.log(`Page URL: ${window.location.href}`);
                    
                    // Check for error messages
                    const alerts = document.querySelectorAll('.alert, .error, .warning');
                    if (alerts.length > 0) {
                        console.log(`Found ${alerts.length} alerts/errors on page`);
                        alerts.forEach((alert, i) => {
                            console.log(`Alert ${i}: ${alert.textContent.trim()}`);
                        });
                    }
                    
                    // Check page content for any obvious issues
                    const bodyText = document.body.textContent;
                    if (bodyText.toLowerCase().includes('no results')) {
                        console.log('Page contains "no results" text');
                    }
                    if (bodyText.toLowerCase().includes('error')) {
                        console.log('Page contains "error" text');
                    }
                    
                    return {
                        count: links.length,
                        links: linkHrefs.slice(0, 5), // Just first 5 for debugging
                        pageTitle: document.title,
                        hasTable: document.querySelectorAll('table').length > 0,
                        hasPagination: document.querySelectorAll('.pager, .pagination').length > 0
                    };
                }, TEST_CONFIG.SELECTORS.specialistLinks);
                
                entityCount = result.count;
                entityLinks = result.links;
                
                console.log(`✅ Page ${pageNum} analysis:`);
                console.log(`   - Found ${entityCount} entities`);
                console.log(`   - Page title: ${result.pageTitle}`);
                console.log(`   - Has table: ${result.hasTable}`);
                console.log(`   - Has pagination: ${result.hasPagination}`);
                console.log(`   - Sample links: ${result.links.slice(0, 3).join(', ')}`);
                
                if (entityCount === 0) {
                    console.log(`❌ No entities found on page ${pageNum} - this is where pagination should stop`);
                } else if (entityCount < 100) {
                    console.log(`⚠️ Only ${entityCount} entities on page ${pageNum} - might be last page or partial load`);
                }
                
            } catch (error) {
                console.log(`❌ Could not find entities on page ${pageNum}: ${error.message}`);
                entityCount = 0;
            }
            
            await browser.close();
            
            // If no entities, this is likely where pagination ends
            if (entityCount === 0) {
                console.log(`📄 Page ${pageNum} has no entities - pagination naturally ends here`);
                break;
            }
            
            // Wait between pages
            console.log('⏳ Waiting 3 seconds before next page...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.log(`❌ Error testing page ${pageNum}: ${error.message}`);
        }
    }
}

// Run the test
try {
    await testPageContinuation();
    console.log('\n🎉 Pagination continuation test completed!');
} catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
}
