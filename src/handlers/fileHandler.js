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
    
    // Process the extracted data - restructure so each website is its own object
    const processedData = extractedData.map(record => {
        return {
            extractedDate: new Date().toISOString().split('T')[0],
            url: record.url,
            doctorname: record.doctorname,
            specialty: record.specialty,
            contact: record.contact,
            unitNumber: record.unitNumber,
            // Include original cookies if provided
            cookies: originalCookies && originalCookies.length > 0 ? originalCookies : undefined
        };
    });
    
    try {
        fs.writeFileSync(filepath, JSON.stringify(processedData, null, 2), 'utf8');
        console.log(`Data successfully saved to: ${filepath}`);
        console.log(`Each of the ${extractedData.length} websites is now saved as a separate object`);
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
