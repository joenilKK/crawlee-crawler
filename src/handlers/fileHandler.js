/**
 * File handling utilities for saving extracted data
 */

import fs from 'fs';
import path from 'path';

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
