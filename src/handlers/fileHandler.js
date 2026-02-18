/**
 * File handling utilities for saving extracted data
 */

import fs from 'fs';
import path from 'path';

// Counter for individual file saves
let fileCounter = 0;

/**
 * Save extracted data to JSON file
 * @param {Array} extractedData - Array of specialist data
 * @param {Object} config - Configuration object
 * @param {Array} originalCookies - Original cookies from input (optional)
 * @returns {Promise<string>} File path where data was saved
 */
export async function saveDataToFile(extractedData, config, originalCookies = null) {
    const filename = config.OUTPUT.getFilename();
    const filepath = path.join(process.cwd(), filename);
    
    console.log(`\nCrawling completed! Saving ${extractedData.length} records to ${filename}`);
    
    // Determine if this is scraper mode or crawler mode
    const isScraperMode = config.CRAWLER?.scraperMode || false;
    
    // Check if this is doctor data and restructure accordingly
    let processedData = extractedData;
    let totalRecords = extractedData.length;
    
    if (isScraperMode && extractedData.length > 0 && extractedData[0].doctors) {
        // This is doctor data, flatten it to the desired structure
        processedData = [];
        extractedData.forEach(pageData => {
            if (pageData.doctors && Array.isArray(pageData.doctors)) {
                pageData.doctors.forEach(doctor => {
                    processedData.push({
                        "Dr Name": doctor.name,
                        "Specialty": doctor.specialty,
                        "Position": doctor.position,
                        "links": doctor.links || []
                    });
                });
            }
        });
        totalRecords = processedData.length;
    }
    
    const jsonData = {
        siteName: config.SITE.name,
        extractedDate: new Date().toISOString().split('T')[0],
        totalRecords: totalRecords,
        mode: isScraperMode ? 'scraper' : 'crawler',
        data: processedData,
        metadata: {
            crawledAt: new Date().toISOString(),
            sourceUrl: isScraperMode ? (config.SCRAPER?.urls?.[0] || config.SITE.startUrl) : config.SITE.startUrl,
            scrapedUrls: isScraperMode ? config.SCRAPER?.urls : undefined,
            customSelectors: isScraperMode ? config.SCRAPER?.customSelectors : undefined
        },
        // Include original cookies if provided
        cookies: originalCookies && originalCookies.length > 0 ? originalCookies : undefined
    };
    
    try {
        fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2), 'utf8');
        console.log(`Data successfully saved to: ${filepath}`);
        return filepath;
    } catch (error) {
        console.error('Error saving data to file:', error);
        throw error;
    }
}

/**
 * Create backup of existing file if it exists
 * @param {string} filename - Name of the file to backup
 * @param {Object} config - Configuration object (optional)
 */
export function createBackupIfExists(filename, config) {
    const filepath = path.join(process.cwd(), filename);
    
    if (fs.existsSync(filepath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = filename.replace('.json', `_backup_${timestamp}.json`);
        const backupPath = path.join(process.cwd(), backupFilename);
        
        try {
            fs.copyFileSync(filepath, backupPath);
            console.log(`Created backup: ${backupFilename}`);
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }
}

/**
 * Save individual result to separate JSON file (Apify-style)
 * @param {Object} result - Single result object
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} File path where data was saved
 */
export async function saveIndividualResult(result, config) {
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'storage', 'datasets', 'default');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Increment counter and format with leading zeros
    fileCounter++;
    const filename = String(fileCounter).padStart(5, '0') + '.json';
    const filepath = path.join(outputDir, filename);
    
    try {
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`💾 Saved: ${filename}`);
        return filepath;
    } catch (error) {
        console.error(`Error saving individual result to ${filename}:`, error);
        throw error;
    }
}

/**
 * Reset file counter (useful when starting a new crawl)
 */
export function resetFileCounter() {
    // Check existing files and start from the next number
    const outputDir = path.join(process.cwd(), 'storage', 'datasets', 'default');
    
    if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir)
            .filter(f => f.match(/^\d{5}\.json$/))
            .sort();
        
        if (files.length > 0) {
            const lastFile = files[files.length - 1];
            const lastNumber = parseInt(lastFile.replace('.json', ''), 10);
            fileCounter = lastNumber;
            console.log(`📊 Continuing from file number: ${fileCounter}`);
        } else {
            fileCounter = 0;
            console.log(`📊 Starting fresh - no existing files found`);
        }
    } else {
        fileCounter = 0;
        console.log(`📊 Creating new output directory`);
    }
}
