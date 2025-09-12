#!/usr/bin/env node

/**
 * Page-by-Page Scraper
 * Manually handles pagination by processing one page at a time
 * This avoids the timeout issues with automatic pagination detection
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TOTAL_PAGES = 11; // We know there are 11 pages
const ENTITIES_PER_PAGE = 100; // We know each page has 100 entities
const DELAY_BETWEEN_PAGES = 60000; // 1 minute between pages
const MAX_RETRIES = 3; // Max retries for failed pages

async function getExistingRecordCount() {
    try {
        const dataFile = path.join(__dirname, 'opengovsg-scraped-data.json');
        if (fs.existsSync(dataFile)) {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            return Array.isArray(data) ? data.length : 0;
        }
        return 0;
    } catch (error) {
        console.warn('Could not read existing data file:', error.message);
        return 0;
    }
}

async function scrapeSpecificPage(pageNumber) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Starting page ${pageNumber} scraping...`);
        
        // Modify the start URL to target specific page
        const pageUrl = pageNumber === 1 ? 
            'https://opengovsg.com/corporate?ssic=86201' :
            `https://opengovsg.com/corporate?ssic=86201&page=${pageNumber}`;
        
        const child = spawn('npm', ['start'], {
            cwd: __dirname,
            stdio: 'inherit',
            env: { 
                ...process.env, 
                CRAWLEE_PURGE_ON_START: '0', // Don't purge data, keep accumulating
                TARGET_PAGE_URL: pageUrl, // Pass the specific page URL
                MAX_REQUESTS: '100' // Limit to 100 entities per page
            }
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Page ${pageNumber} completed successfully`);
                resolve();
            } else {
                console.log(`❌ Page ${pageNumber} exited with code ${code}`);
                reject(new Error(`Page ${pageNumber} failed with code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            console.error(`❌ Page ${pageNumber} error:`, error);
            reject(error);
        });
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('🎯 Page-by-Page Scraper Started');
    console.log(`📊 Target: ${TOTAL_PAGES} pages × ${ENTITIES_PER_PAGE} entities = ${TOTAL_PAGES * ENTITIES_PER_PAGE} total entities`);
    console.log(`⏱️  Delay between pages: ${DELAY_BETWEEN_PAGES / 1000} seconds`);
    
    const initialCount = await getExistingRecordCount();
    console.log(`📈 Starting with ${initialCount} existing records`);
    
    // Calculate which page to start from based on existing data
    const startPage = Math.floor(initialCount / ENTITIES_PER_PAGE) + 1;
    console.log(`🎯 Starting from page ${startPage} (based on ${initialCount} existing records)`);
    
    for (let pageNumber = startPage; pageNumber <= TOTAL_PAGES; pageNumber++) {
        let retries = 0;
        let pageSuccess = false;
        
        while (!pageSuccess && retries < MAX_RETRIES) {
            try {
                console.log(`\n📄 Processing page ${pageNumber}/${TOTAL_PAGES} (attempt ${retries + 1}/${MAX_RETRIES})`);
                
                await scrapeSpecificPage(pageNumber);
                pageSuccess = true;
                
                const currentCount = await getExistingRecordCount();
                const newRecords = currentCount - initialCount;
                console.log(`📊 Total records scraped so far: ${newRecords} (${currentCount} total)`);
                
                // Calculate expected records for this page
                const expectedForThisPage = pageNumber * ENTITIES_PER_PAGE;
                const actualForThisPage = currentCount - initialCount;
                
                if (actualForThisPage >= expectedForThisPage - 10) { // Allow for some failed extractions
                    console.log(`✅ Page ${pageNumber} appears complete (${actualForThisPage}/${expectedForThisPage} entities)`);
                } else {
                    console.log(`⚠️ Page ${pageNumber} may be incomplete (${actualForThisPage}/${expectedForThisPage} entities)`);
                }
                
                // Wait between pages if not the last page
                if (pageNumber < TOTAL_PAGES) {
                    console.log(`⏳ Waiting ${DELAY_BETWEEN_PAGES / 1000} seconds before next page...`);
                    await sleep(DELAY_BETWEEN_PAGES);
                }
                
            } catch (error) {
                retries++;
                console.error(`❌ Page ${pageNumber} failed (attempt ${retries}/${MAX_RETRIES}):`, error.message);
                
                if (retries >= MAX_RETRIES) {
                    console.error(`💀 Page ${pageNumber} failed after ${MAX_RETRIES} attempts. Continuing to next page.`);
                    break;
                }
                
                // Wait longer before retry
                const retryDelay = DELAY_BETWEEN_PAGES * 1.5;
                console.log(`⏳ Waiting ${retryDelay / 1000} seconds before retry...`);
                await sleep(retryDelay);
            }
        }
    }
    
    const finalCount = await getExistingRecordCount();
    const totalNewRecords = finalCount - initialCount;
    console.log(`\n🎉 Page-by-page scraper completed!`);
    console.log(`📊 Total new records scraped: ${totalNewRecords}`);
    console.log(`📊 Final total records: ${finalCount}`);
    console.log(`🎯 Target was ${TOTAL_PAGES * ENTITIES_PER_PAGE} entities`);
    
    if (finalCount >= (TOTAL_PAGES * ENTITIES_PER_PAGE) - 50) { // Allow for some failures
        console.log(`✅ SUCCESS: Reached target number of entities!`);
    } else {
        console.log(`⚠️ Only collected ${finalCount} entities out of expected ${TOTAL_PAGES * ENTITIES_PER_PAGE}`);
    }
}

// Handle process interruption
process.on('SIGINT', () => {
    console.log('\n🛑 Page-by-page scraper interrupted by user');
    process.exit(0);
});

main().catch(error => {
    console.error('💥 Page-by-page scraper failed:', error);
    process.exit(1);
});
