/**
 * Environment detection and configuration utilities
 */

/**
 * Detect if we're running in Apify environment
 * @returns {boolean} True if running in Apify
 */
export function isApifyEnvironment() {
    return !!(process.env.APIFY_ACTOR_ID || process.env.APIFY_TOKEN || process.env.APIFY_DEFAULT_DATASET_ID);
}

/**
 * Get configuration based on environment
 * @returns {Promise<Object>} Configuration object
 */
export async function getConfiguration() {
    if (isApifyEnvironment()) {
        console.log('🏢 Running in Apify environment - using Actor input');
        const { Actor } = await import('apify');
        
        // Initialize Actor only in Apify environment
        await Actor.init();
        
        // Get input from Apify Actor
        const input = await Actor.getInput();
        
        if (!input) {
            throw new Error('❌ No input provided to Apify Actor');
        }
        
        return { input, isApify: true, Actor };
    } else {
        console.log('💻 Running in local environment - using local configuration');
        const { LOCAL_CONFIG } = await import('./local-config.js');
        
        // Only pass outputFilename from local config
        const input = {
            outputFilename: LOCAL_CONFIG.outputFilename
        };
        
        return { input, isApify: false, Actor: null };
    }
}

/**
 * Handle data output based on environment
 * @param {Array} data - Extracted data
 * @param {Object} config - Configuration object
 * @param {Object} Actor - Apify Actor instance (null for local)
 * @param {boolean} isApify - Whether running in Apify
 * @param {Array} originalCookies - Original cookies from input (optional)
 */
export async function handleDataOutput(data, config, Actor, isApify, originalCookies = null) {
    const summary = {
        totalRecords: data.length,
        siteName: config.SITE.name,
        startUrl: config.SITE.startUrl,
        extractedAt: new Date().toISOString(),
        outputFile: config.OUTPUT.getFilename()
    };

    if (isApify && Actor) {
        // Store results in Apify dataset - push each item individually (already done during crawl)
        console.log(`📊 ${data.length} records stored in Apify dataset`);
    } else {
        // For local environment, just log the summary
        console.log('📊 Crawling Summary:', summary);
    }
}

/**
 * Save single result immediately (Apify-style)
 * @param {Object} item - Single data item to save
 * @param {Object} Actor - Apify Actor instance (null for local)
 * @param {boolean} isApify - Whether running in Apify
 * @param {Object} config - Configuration object (for local file saving)
 */
export async function saveResultImmediately(item, Actor, isApify, config = null) {
    if (isApify && Actor) {
        await Actor.pushData(item);
        console.log(`💾 Saved result to Apify dataset`);
    } else if (config) {
        // For local mode, save as individual files
        const { saveIndividualResult } = await import('../handlers/fileHandler.js');
        await saveIndividualResult(item, config);
    }
}

/**
 * Handle Actor exit based on environment
 * @param {Object} Actor - Apify Actor instance (null for local)
 * @param {boolean} isApify - Whether running in Apify
 */
export async function handleExit(Actor, isApify) {
    if (isApify && Actor) {
        await Actor.exit();
    } else {
        console.log('✅ Local crawling completed successfully');
        process.exit(0);
    }
}
