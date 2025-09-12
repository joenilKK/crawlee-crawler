#!/usr/bin/env node

/**
 * Direct Page Scraper
 * Directly scrapes each page from 1 to 11 without complex pagination logic
 * This avoids timeout issues with automatic pagination detection
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the data extractor
import { extractSpecialistData } from './src/handlers/dataExtractor.js';
import { saveDataToFile } from './src/handlers/fileHandler.js';

// Configuration
const BASE_URL = 'https://opengovsg.com/corporate?ssic=86201';
const TOTAL_PAGES = 11;
const DELAY_BETWEEN_ENTITIES = 5000; // 5 seconds  
const DELAY_BETWEEN_PAGES = 10000; // 10 seconds

const CONFIG = {
    SELECTORS: {
        specialistLinks: '.panel-card .panel-body .table tr > td > a',
        doctorName: '.panel-heading h1',
        specialty: '',
        contactLinks: '',
        tableRows: '#overview.panel-card .panel-body .table tbody tr',
    },
    CRAWLER: {
        headless: true,
        timeout: 60000,
    }
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getExistingData() {
    try {
        const dataFile = path.join(__dirname, 'opengovsg-scraped-data.json');
        if (fs.existsSync(dataFile)) {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            return Array.isArray(data) ? data : [];
        }
        return [];
    } catch (error) {
        console.warn('Could not read existing data file:', error.message);
        return [];
    }
}

async function extractEntityData(entityUrl, config) {
    let browser = null;
    try {
        console.log(`🔍 Extracting: ${entityUrl}`);
        
        browser = await chromium.launch({
            headless: config.CRAWLER.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        page.setDefaultTimeout(config.CRAWLER.timeout);
        
        await page.goto(entityUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        const entityData = await extractSpecialistData(page, entityUrl, config);
        entityData.url = entityUrl;
        
        console.log(`✅ Extracted: ${entityData.entityName || 'Unknown'}`);
        return { success: true, data: entityData };
        
    } catch (error) {
        console.error(`❌ Failed to extract ${entityUrl}:`, error.message);
        return { 
            success: false, 
            data: {
                url: entityUrl,
                entityName: 'Extraction failed',
                overview: [],
                error: error.message
            }
        };
    } finally {
        if (browser) await browser.close();
    }
}

async function scrapePageEntities(pageNumber, existingData) {
    console.log(`\n📄 Processing page ${pageNumber}/${TOTAL_PAGES}`);
    
    const pageUrl = pageNumber === 1 ? BASE_URL : `${BASE_URL}&page=${pageNumber}`;
    console.log(`🌐 Page URL: ${pageUrl}`);
    
    let browser = null;
    let entityLinks = [];
    
    try {
        // Get entity links from the page
        browser = await chromium.launch({
            headless: CONFIG.CRAWLER.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        page.setDefaultTimeout(CONFIG.CRAWLER.timeout);
        
        console.log(`📡 Loading page ${pageNumber}...`);
        await page.goto(pageUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Wait for entity links
        await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: 15000 });
        
        entityLinks = await page.evaluate((selector) => {
            const links = document.querySelectorAll(selector);
            return Array.from(links).map(link => link.href).filter(href => href);
        }, CONFIG.SELECTORS.specialistLinks);
        
        console.log(`✅ Found ${entityLinks.length} entities on page ${pageNumber}`);
        
    } catch (error) {
        console.error(`❌ Error loading page ${pageNumber}:`, error.message);
        return existingData;
    } finally {
        if (browser) await browser.close();
    }
    
    if (entityLinks.length === 0) {
        console.log(`📄 No entities found on page ${pageNumber} - might be end of data`);
        return existingData;
    }
    
    // Process each entity
    const newData = [...existingData];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < entityLinks.length; i++) {
        const entityUrl = entityLinks[i];
        console.log(`\n📋 Processing entity ${i + 1}/${entityLinks.length} on page ${pageNumber}`);
        
        // Extract entity data
        const result = await extractEntityData(entityUrl, CONFIG);
        newData.push(result.data);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
        
        // Save incrementally
        await saveDataToFile(newData, { OUTPUT: { getFilename: () => 'opengovsg-scraped-data.json' } });
        
        // Wait between entities
        if (i < entityLinks.length - 1) {
            console.log(`⏳ Waiting ${DELAY_BETWEEN_ENTITIES}ms before next entity...`);
            await sleep(DELAY_BETWEEN_ENTITIES);
        }
    }
    
    console.log(`\n✅ Page ${pageNumber} completed: ${successCount} success, ${failCount} failed`);
    console.log(`📊 Total entities so far: ${newData.length}`);
    
    return newData;
}

async function main() {
    console.log('🎯 Direct Page Scraper Started');
    console.log(`📊 Target: ${TOTAL_PAGES} pages to scrape all entities`);
    console.log(`⏱️  Delays: ${DELAY_BETWEEN_ENTITIES}ms between entities, ${DELAY_BETWEEN_PAGES}ms between pages`);
    
    let allData = await getExistingData();
    console.log(`📈 Starting with ${allData.length} existing records`);
    
    // Calculate which page to start from
    const startPage = Math.floor(allData.length / 100) + 1;
    console.log(`🎯 Starting from page ${startPage} (based on ${allData.length} existing records)`);
    
    for (let pageNumber = startPage; pageNumber <= TOTAL_PAGES; pageNumber++) {
        try {
            allData = await scrapePageEntities(pageNumber, allData);
            
            // Wait between pages
            if (pageNumber < TOTAL_PAGES) {
                console.log(`⏳ Waiting ${DELAY_BETWEEN_PAGES}ms before next page...`);
                await sleep(DELAY_BETWEEN_PAGES);
            }
            
        } catch (error) {
            console.error(`❌ Error processing page ${pageNumber}:`, error.message);
            // Continue to next page
        }
    }
    
    console.log(`\n🎉 Direct page scraper completed!`);
    console.log(`📊 Final total records: ${allData.length}`);
    console.log(`🎯 Expected around ${TOTAL_PAGES * 100} entities`);
    
    if (allData.length >= 1000) {
        console.log(`✅ SUCCESS: Collected ${allData.length} entities!`);
    } else {
        console.log(`⚠️ Collected ${allData.length} entities - may need to check for missing pages`);
    }
}

// Handle interruption
process.on('SIGINT', () => {
    console.log('\n🛑 Direct scraper interrupted by user');
    process.exit(0);
});

main().catch(error => {
    console.error('💥 Direct scraper failed:', error);
    process.exit(1);
});
