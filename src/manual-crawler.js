/**
 * Manual crawler for handling sites with strict blocking
 * This bypasses Crawlee's automatic request handling
 */

import { chromium } from 'playwright';
import { waitForManualIntervention, checkForManualIntervention, checkForSuccessfulPageLoad, debugPageState, handleWhitePage, checkForChallengeLoop } from './utils/manualMode.js';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';

/**
 * Run manual crawler
 * @param {Object} CONFIG - Configuration object
 */
export async function runManualCrawler(CONFIG) {
    console.log('🚀 Starting Manual Crawler');
    console.log(`📍 Target URL: ${CONFIG.SITE.startUrl}`);
    
    // Create backup of existing file if needed
    createBackupIfExists(CONFIG.OUTPUT.getFilename(), CONFIG);
    
    // Launch browser with basic options
    const browser = await chromium.launch({
        headless: CONFIG.CRAWLER.headless
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        // Additional context options to prevent white page issues
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        javaScriptEnabled: true,
        // Set reasonable timeouts
        timeout: CONFIG.CRAWLER.timeout,
        // Extra headers to appear more legitimate
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    
    
    const page = await context.newPage();
    
    
    let extractedData = [];
    
    try {
        console.log(`🌐 Navigating to: ${CONFIG.SITE.startUrl}`);
        
        // Navigate to the start URL with enhanced challenge handling
        try {
            const hostname = new URL(CONFIG.SITE.startUrl).hostname;
            
            // For SGP Business, try homepage first to establish session
            if (hostname.includes('sgpbusiness.com')) {
                console.log('🎯 SGP Business: Trying homepage first to establish session...');
                try {
                    const homepageResponse = await page.goto(CONFIG.SITE.baseUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: CONFIG.CRAWLER.timeout
                    });
                    console.log(`📊 Homepage response: ${homepageResponse?.status() || 'unknown'}`);
                    
                    // Wait and handle homepage challenges
                    await page.waitForTimeout(10000);
                    await debugPageState(page, 'Homepage Load');
                    
                    const homepageNeedsIntervention = await checkForManualIntervention(page);
                    if (homepageNeedsIntervention) {
                        await waitForManualIntervention(page, CONFIG.SITE.baseUrl, 'Homepage challenge - establish session first');
                        await page.waitForTimeout(10000);
                    }
                    
                    console.log('✅ Homepage session established, now navigating to target page...');
                } catch (homepageError) {
                    console.log(`⚠️ Homepage navigation failed: ${homepageError.message}`);
                }
            }
            
            console.log(`🔄 Attempting to navigate to: ${CONFIG.SITE.startUrl}`);
            
            // Now navigate to the actual target URL
            let response;
            try {
                response = await page.goto(CONFIG.SITE.startUrl, {
                    waitUntil: 'networkidle',
                    timeout: CONFIG.CRAWLER.timeout
                });
            } catch (timeoutError) {
                console.log('⏰ Network idle timeout, trying with domcontentloaded...');
                response = await page.goto(CONFIG.SITE.startUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: CONFIG.CRAWLER.timeout
                });
            }
            
            // Wait additional time for any dynamic content
            await page.waitForTimeout(5000);
            
            console.log(`📊 Response status: ${response?.status() || 'unknown'}`);
            
            // Check for white page issue first
            const pageRecovered = await handleWhitePage(page);
            if (!pageRecovered) {
                console.log('⚠️ White page detected - requesting manual intervention');
                await waitForManualIntervention(page, CONFIG.SITE.startUrl, 'White/blank page detected - please check browser window');
            }
            
            // Debug initial page state
            await debugPageState(page, 'Initial Page Load');
            
            // For SGP Business, skip automatic handling and go straight to manual
            if (hostname.includes('sgpbusiness.com')) {
                console.log('🎯 SGP Business detected - using manual-first approach');
                console.log('⏰ Giving extra time for page to load...');
                await page.waitForTimeout(10000); // Extra wait for SGP Business
                
                await debugPageState(page, 'SGP Business Initial State');
                
                // Always request manual intervention for SGP Business
                await waitForManualIntervention(page, CONFIG.SITE.startUrl, 'SGP Business requires manual challenge handling');
                
                // After manual intervention, wait even longer
                console.log('⏰ Waiting extra time after manual intervention for SGP Business...');
                await page.waitForTimeout(15000);
                
                await debugPageState(page, 'SGP Business After Manual Intervention');
                
            }
            
            // Check for any remaining manual intervention needs
            const needsIntervention = await checkForManualIntervention(page);
            if (needsIntervention || (response && [403, 429, 503].includes(response.status()))) {
                await waitForManualIntervention(page, CONFIG.SITE.startUrl, 'Challenge, blocking, or rate limiting detected');
                
                // After manual intervention, verify the page loaded successfully
                const pageLoadedSuccessfully = await checkForSuccessfulPageLoad(page);
                if (!pageLoadedSuccessfully) {
                    console.log('⚠️ Page may not have loaded correctly after manual intervention');
                    console.log('🔄 You may need to navigate to the correct page manually');
                    await waitForManualIntervention(page, page.url(), 'Please navigate to the target page if needed');
                }
            }
            
            
        } catch (error) {
            console.log(`⚠️ Navigation error: ${error.message}`);
            console.log(`🔧 Error details: ${error.stack}`);
            await waitForManualIntervention(page, CONFIG.SITE.startUrl, `Navigation failed: ${error.message}`);
        }
        
        // Now try to find specialist links
        console.log(`🔍 Looking for specialist links with selector: ${CONFIG.SELECTORS.specialistLinks}`);
        
        try {
            await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { 
                timeout: 10000 
            });
            console.log('✅ Specialist links found!');
        } catch (error) {
            console.log('❌ Specialist links not found automatically');
            await waitForManualIntervention(page, page.url(), 'Specialist links not found - please navigate to the correct page');
        }
        
        // Get all specialist links
        const specialistLinks = await page.$$eval(CONFIG.SELECTORS.specialistLinks, links => 
            links.map(link => link.href).filter(href => href)
        );
        
        console.log(`📋 Found ${specialistLinks.length} specialist links`);
        
        // Process each specialist (limited by maxRequestsPerCrawl)
        const linksToProcess = specialistLinks.slice(0, CONFIG.CRAWLER.maxRequestsPerCrawl);
        
        for (let i = 0; i < linksToProcess.length; i++) {
            const link = linksToProcess[i];
            console.log(`\n🔗 Processing specialist ${i + 1}/${linksToProcess.length}: ${link}`);
            
            try {
                console.log(`🔄 Navigating to specialist page: ${link}`);
                
                const response = await page.goto(link, {
                    waitUntil: 'domcontentloaded',
                    timeout: CONFIG.CRAWLER.timeout
                });
                
                console.log(`📊 Response status: ${response?.status() || 'unknown'}`);
                
                
                // Check if manual intervention is needed
                const needsIntervention = await checkForManualIntervention(page);
                if (needsIntervention || (response && [403, 429, 503].includes(response.status()))) {
                    await waitForManualIntervention(page, link, 'Specialist page blocked or rate limited - manual intervention needed');
                    
                    // Verify the page loaded successfully after manual intervention
                    const pageLoadedSuccessfully = await checkForSuccessfulPageLoad(page);
                    if (!pageLoadedSuccessfully) {
                        console.log('⚠️ Specialist page may not have loaded correctly after manual intervention');
                        await waitForManualIntervention(page, page.url(), 'Please ensure the specialist page is loaded correctly');
                    }
                }
                
                
                // Extract specialist data
                const specialistData = await extractSpecialistData(page, link, CONFIG);
                extractedData.push(specialistData);
                
                console.log(`✅ Extracted data for: ${specialistData.doctorName || 'Unknown'}`);
                
                // Human-like delay between requests
                const delay = Math.random() * 3000 + 2000; // 2-5 seconds
                console.log(`⏱️ Waiting ${Math.round(delay)}ms before next request`);
                await page.waitForTimeout(delay);
                
            } catch (error) {
                console.log(`❌ Error processing ${link}: ${error.message}`);
                console.log(`🔧 Error details: ${error.stack}`);
                
                // Try manual intervention for errors
                await waitForManualIntervention(page, link, `Error processing specialist page: ${error.message}`);
                
                // Try to extract data anyway after manual intervention
                try {
                    const specialistData = await extractSpecialistData(page, link, CONFIG);
                    extractedData.push(specialistData);
                    console.log(`✅ Extracted data after manual intervention: ${specialistData.doctorName || 'Unknown'}`);
                } catch (extractError) {
                    console.log(`❌ Could not extract data even after manual intervention: ${extractError.message}`);
                    // Add placeholder data to track the failure
                    extractedData.push({
                        url: link,
                        doctorName: 'EXTRACTION_FAILED',
                        error: extractError.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
    } finally {
        await browser.close();
    }
    
    // Save extracted data
    const outputPath = await saveDataToFile(extractedData, CONFIG);
    
    console.log(`\n✅ Manual crawling completed!`);
    console.log(`📊 Found ${extractedData.length} specialists`);
    console.log(`📁 Data saved to: ${outputPath}`);
    
    return extractedData;
}
