/**
 * Scraper-only mode for extracting data from specific URLs without crawling
 */

import { PlaywrightCrawler } from 'crawlee';
import { saveDataToFile, createBackupIfExists, resetFileCounter } from './handlers/fileHandler.js';
import { extractCustomData } from './handlers/dataExtractor.js';
import { extractDoctorData, extractDoctorDataFallback } from './handlers/doctorExtractor.js';
import { saveResultImmediately } from './config/environment.js';


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

/**
 * Run scraper-only mode
 * @param {Object} config - Configuration object
 * @param {Object} Actor - Apify Actor instance (null for local)
 * @param {boolean} isApify - Whether running in Apify
 * @returns {Promise<Array>} Array of extracted data
 */
export async function runScraperOnly(config, Actor = null, isApify = false) {
    console.log('🎯 Starting scraper-only mode');
    console.log(`📝 URLs to scrape: ${config.SCRAPER?.urls?.length || 0}`);
    
    if (!config.SCRAPER?.urls || config.SCRAPER.urls.length === 0) {
        throw new Error('❌ No URLs provided for scraper mode. Please add URLs to scraperUrls array in configuration.');
    }
    
    const extractedData = [];
    
    // Initialize file counter for local mode
    if (!isApify) {
        resetFileCounter();
    }
    
    // Create backup of existing file if needed
    createBackupIfExists(config.OUTPUT.getFilename(), config);
    
    // Convert cookies to Playwright format
    const playwrightCookies = convertCookiesToPlaywrightFormat(config.COOKIES || []);
    
    console.log(`🍪 Loading ${playwrightCookies.length} cookies for scraper session`);
    if (playwrightCookies.length > 0) {
        console.log('Cookie domains:', [...new Set(playwrightCookies.map(c => c.domain))].join(', '));
    }
    
    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                headless: config.CRAWLER.headless,
                ignoreHTTPSErrors: true
            }
        },
        // Add pre-navigation handler to set cookies
        preNavigationHooks: [
            async ({ page, request }) => {
                // Set cookies before navigation if we have any
                if (playwrightCookies.length > 0) {
                    try {
                        await page.context().addCookies(playwrightCookies);
                        console.log(`🍪 Applied ${playwrightCookies.length} cookies to scraper page context`);
                    } catch (error) {
                        console.warn(`⚠️ Failed to set some cookies in scraper: ${error.message}`);
                    }
                }
            }
        ],
        sessionPoolOptions: {
            blockedStatusCodes: [],
            maxPoolSize: 1,
            sessionOptions: {
                maxErrorScore: 10,
                errorScoreDecrement: 0.5,
            }
        },
        requestHandlerTimeoutSecs: 120,
        navigationTimeoutSecs: 60,
        minConcurrency: 1,
        maxConcurrency: 1,
        
        requestHandler: async ({ page, request }) => {
            console.log(`🌐 Processing URL: ${request.url}`);
            
            // Add delay to mimic human behavior
            const delay = Math.random() * 3000 + 2000;
            console.log(`⏱️ Waiting ${Math.round(delay)}ms before processing`);
            await page.waitForTimeout(delay);
            
            
            // Check if user wants specialized doctor extraction or general custom extraction
            let pageResults;
            
            // Check if custom selectors contain doctor-specific fields
            const hasDoctorFields = config.SCRAPER.customSelectors && (
                config.SCRAPER.customSelectors.doctorName || 
                config.SCRAPER.customSelectors.position || 
                config.SCRAPER.customSelectors.phoneLinks ||
                config.SCRAPER.customSelectors.doctorCards
            );
            
            if (hasDoctorFields) {
                console.log('🏥 Using specialized doctor extractor based on custom selectors');
                
                // Try the main doctor extractor first (returns array of flat objects)
                pageResults = await extractDoctorData(page, request.url, config.SCRAPER.customSelectors);
                
                // If no doctors found, try the fallback method
                if (pageResults.length === 0) {
                    console.log('🔄 No doctors found with main extractor, trying fallback method');
                    pageResults = await extractDoctorDataFallback(page, request.url, config.SCRAPER.customSelectors);
                }
            } else {
                console.log('🌐 Using general custom data extractor');
                const pageData = await extractCustomData(page, request.url, config.SCRAPER.customSelectors);
                pageResults = [pageData];
            }
            
            // Save each result immediately (Apify-style)
            for (const result of pageResults) {
                extractedData.push(result);
                await saveResultImmediately(result, Actor, isApify, config);
            }
            
            console.log(`✅ Completed scraping: ${request.url} (${pageResults.length} records)`);
        },
        
        failedRequestHandler: async ({ request, error }) => {
            console.error(`❌ Failed to scrape ${request.url}:`, error.message);
            
            // Add failed URL data with error
            const failedResult = {
                url: request.url,
                error: error.message,
                extractedAt: new Date().toISOString()
            };
            
            extractedData.push(failedResult);
            await saveResultImmediately(failedResult, Actor, isApify, config);
        }
    });
    
    // Convert URLs to request objects
    const requests = config.SCRAPER.urls.map(url => ({
        url: url,
        uniqueKey: url
    }));
    
    // Run the scraper
    await crawler.run(requests);
    
    // Save extracted data to JSON file
    const outputPath = await saveDataToFile(extractedData, config, config.COOKIES);
    console.log(`📁 Scraped data saved to: ${outputPath}`);
    
    console.log(`🎯 Scraper-only mode completed! Processed ${extractedData.length} URLs.`);
    
    return extractedData;
}
