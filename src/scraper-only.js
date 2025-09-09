/**
 * Scraper-only mode for extracting data from specific URLs without crawling
 */

import { PlaywrightCrawler } from 'crawlee';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { extractCustomData } from './handlers/dataExtractor.js';
import { extractDoctorData, extractDoctorDataFallback } from './handlers/doctorExtractor.js';
import { 
    waitForManualIntervention,
    checkForManualIntervention
} from './utils/manualMode.js';


/**
 * Run scraper-only mode
 * @param {Object} config - Configuration object
 * @returns {Promise<Array>} Array of extracted data
 */
export async function runScraperOnly(config) {
    console.log('🎯 Starting scraper-only mode');
    console.log(`📝 URLs to scrape: ${config.SCRAPER?.urls?.length || 0}`);
    
    if (!config.SCRAPER?.urls || config.SCRAPER.urls.length === 0) {
        throw new Error('❌ No URLs provided for scraper mode. Please add URLs to scraperUrls array in configuration.');
    }
    
    const extractedData = [];
    
    // Create backup of existing file if needed
    createBackupIfExists(config.OUTPUT.getFilename(), config);
    
    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                headless: config.CRAWLER.headless,
                ignoreHTTPSErrors: true
            }
        },
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
            
            // Handle challenges if manual mode is enabled
            if (config.CRAWLER.manualMode) {
                console.log('👤 Manual mode enabled - checking for challenges');
                const needsIntervention = await checkForManualIntervention(page);
                if (needsIntervention) {
                    await waitForManualIntervention(page, request.url, 'Challenge detected in scraper mode');
                }
            }
            
            // Check if this looks like a medical/doctor website and use specialized extractor
            const pageTitle = await page.title();
            const isDoctorSite = pageTitle.toLowerCase().includes('doctor') || 
                               pageTitle.toLowerCase().includes('hospital') || 
                               pageTitle.toLowerCase().includes('medical') ||
                               pageTitle.toLowerCase().includes('clinic') ||
                               request.url.includes('doctor') ||
                               request.url.includes('medical') ||
                               request.url.includes('hospital');
            
            let pageData;
            
            if (isDoctorSite && config.SCRAPER.customSelectors) {
                console.log('🏥 Detected medical site - using specialized doctor extractor');
                
                // Try the main doctor extractor first
                pageData = await extractDoctorData(page, request.url, config.SCRAPER.customSelectors);
                
                // If no doctors found, try the fallback method
                if (pageData.doctors && pageData.doctors.length === 0) {
                    console.log('🔄 No doctors found with main extractor, trying fallback method');
                    pageData = await extractDoctorDataFallback(page, request.url, config.SCRAPER.customSelectors);
                }
            } else {
                console.log('🌐 Using general custom data extractor');
                pageData = await extractCustomData(page, request.url, config.SCRAPER.customSelectors);
            }
            
            extractedData.push(pageData);
            
            console.log(`✅ Completed scraping: ${request.url}`);
        },
        
        failedRequestHandler: async ({ request, error }) => {
            console.error(`❌ Failed to scrape ${request.url}:`, error.message);
            
            // Add failed URL data with error
            extractedData.push({
                url: request.url,
                error: error.message,
                extractedAt: new Date().toISOString(),
                data: null
            });
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
    const outputPath = await saveDataToFile(extractedData, config);
    console.log(`📁 Scraped data saved to: ${outputPath}`);
    
    console.log(`🎯 Scraper-only mode completed! Processed ${extractedData.length} URLs.`);
    
    return extractedData;
}
