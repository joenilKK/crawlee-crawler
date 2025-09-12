#!/usr/bin/env node

/**
 * Batch Scraper Runner
 * Runs the main scraper in batches to prevent browser accumulation issues
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration  
const BATCH_SIZE = -1; // No limit - run until pagination naturally ends
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds between batches (if needed)
const MAX_RETRIES = 3; // Max retries for failed batches

async function runBatch(batchNumber, totalBatches) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Starting batch ${batchNumber}/${totalBatches}`);
        console.log(`⏳ Processing up to ${BATCH_SIZE} entities in this batch`);
        
        const child = spawn('npm', ['start'], {
            cwd: __dirname,
            stdio: 'inherit',
            env: { 
                ...process.env, 
                CRAWLEE_PURGE_ON_START: '0' // Don't purge data, keep accumulating
            }
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Batch ${batchNumber} completed successfully`);
                resolve();
            } else {
                console.log(`❌ Batch ${batchNumber} exited with code ${code}`);
                reject(new Error(`Batch failed with code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            console.error(`❌ Batch ${batchNumber} error:`, error);
            reject(error);
        });
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function main() {
    console.log('🤖 Batch Scraper Runner Started');
    console.log(`📊 Batch size: ${BATCH_SIZE} entities`);
    console.log(`⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES / 1000} seconds`);
    
    const initialCount = await getExistingRecordCount();
    console.log(`📈 Starting with ${initialCount} existing records`);
    
    let batchNumber = 1;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    while (consecutiveFailures < maxConsecutiveFailures) {
        try {
            await runBatch(batchNumber, '∞');
            consecutiveFailures = 0; // Reset failure count on success
            
            const currentCount = await getExistingRecordCount();
            const newRecords = currentCount - initialCount;
            console.log(`📊 Total records scraped so far: ${newRecords}`);
            
            // Wait between batches to let the server recover
            console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
            await sleep(DELAY_BETWEEN_BATCHES);
            
            batchNumber++;
            
        } catch (error) {
            consecutiveFailures++;
            console.error(`❌ Batch ${batchNumber} failed (${consecutiveFailures}/${maxConsecutiveFailures}):`, error.message);
            
            if (consecutiveFailures >= maxConsecutiveFailures) {
                console.error(`💀 Maximum consecutive failures reached (${maxConsecutiveFailures}). Stopping.`);
                break;
            }
            
            // Wait longer after failure
            const retryDelay = DELAY_BETWEEN_BATCHES * 2;
            console.log(`⏳ Waiting ${retryDelay / 1000} seconds before retry...`);
            await sleep(retryDelay);
        }
    }
    
    const finalCount = await getExistingRecordCount();
    const totalNewRecords = finalCount - initialCount;
    console.log(`\n🎉 Batch scraper completed!`);
    console.log(`📊 Total new records scraped: ${totalNewRecords}`);
    console.log(`📊 Final total records: ${finalCount}`);
}

// Handle process interruption
process.on('SIGINT', () => {
    console.log('\n🛑 Batch scraper interrupted by user');
    process.exit(0);
});

main().catch(error => {
    console.error('💥 Batch scraper failed:', error);
    process.exit(1);
});
