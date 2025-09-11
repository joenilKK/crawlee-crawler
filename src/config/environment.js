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
        
        // Import local config to get default values for missing fields
        const { LOCAL_CONFIG } = await import('./local-config.js');
        
        // Ensure required fields have default values from local config
        const processedInput = {
            maxRequestsPerCrawl: input.maxRequestsPerCrawl !== undefined ? input.maxRequestsPerCrawl : LOCAL_CONFIG.maxRequestsPerCrawl,
            cookies: input.cookies || LOCAL_CONFIG.cookies || [],
            headless: input.headless !== undefined ? input.headless : LOCAL_CONFIG.headless,
            outputFilename: input.outputFilename || LOCAL_CONFIG.outputFilename || ''
        };
        
        return { input: processedInput, isApify: true, Actor };
    } else {
        console.log('💻 Running in local environment - using local configuration');
        const { LOCAL_CONFIG } = await import('./local-config.js');
        
        // Convert local config to Apify input format
        const input = {
            maxRequestsPerCrawl: LOCAL_CONFIG.maxRequestsPerCrawl,
            cookies: LOCAL_CONFIG.cookies || [],
            headless: LOCAL_CONFIG.headless,
            outputFilename: LOCAL_CONFIG.outputFilename || ''
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
        // Store results in Apify dataset
        await Actor.pushData({
            summary,
            specialists: data,
            // Include original cookies if provided
            cookies: originalCookies && originalCookies.length > 0 ? originalCookies : undefined
        });
        console.log(`📊 Data stored in Apify dataset`);
    } else {
        // For local environment, just log the summary
        console.log('📊 Crawling Summary:', summary);
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
