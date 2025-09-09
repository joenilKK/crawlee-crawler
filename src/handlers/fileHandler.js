/**
 * File handling utilities for saving extracted data
 */

import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/config.js';

/**
 * Save extracted data to JSON file
 * @param {Array} extractedData - Array of specialist data
 * @returns {Promise<string>} File path where data was saved
 */
export async function saveDataToFile(extractedData) {
    const filename = CONFIG.OUTPUT.getFilename();
    const filepath = path.join(process.cwd(), filename);
    
    console.log(`\nCrawling completed! Saving ${extractedData.length} records to ${filename}`);
    
    const jsonData = {
        siteName: CONFIG.SITE.name,
        extractedDate: new Date().toISOString().split('T')[0],
        totalRecords: extractedData.length,
        specialists: extractedData,
        metadata: {
            crawledAt: new Date().toISOString(),
            sourceUrl: CONFIG.SITE.startUrl
        }
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
 */
export function createBackupIfExists(filename) {
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
