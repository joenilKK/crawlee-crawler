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
        
        // Convert local config to Apify input format
        const input = {
            siteName: LOCAL_CONFIG.siteName,
            baseUrl: LOCAL_CONFIG.baseUrl,
            startUrl: LOCAL_CONFIG.startUrl,
            allowedUrlPatterns: LOCAL_CONFIG.allowedUrlPatterns,
            excludedUrlPatterns: LOCAL_CONFIG.excludedUrlPatterns,
            paginationType: LOCAL_CONFIG.paginationType,
            queryPattern: LOCAL_CONFIG.queryPattern,
            pathPattern: LOCAL_CONFIG.pathPattern,
            paginationBaseUrl: LOCAL_CONFIG.paginationBaseUrl,
            startPage: LOCAL_CONFIG.startPage,
            specialistLinksSelector: LOCAL_CONFIG.specialistLinksSelector,
            nextButtonSelector: LOCAL_CONFIG.nextButtonSelector,
            nextButtonContainerSelector: LOCAL_CONFIG.nextButtonContainerSelector,
            doctorNameSelector: LOCAL_CONFIG.doctorNameSelector,
            contactLinksSelector: LOCAL_CONFIG.contactLinksSelector,
            maxRequestsPerCrawl: LOCAL_CONFIG.maxRequestsPerCrawl,
            headless: LOCAL_CONFIG.headless,
            timeout: LOCAL_CONFIG.timeout,
            outputFilename: LOCAL_CONFIG.outputFilename,
            userAgent: LOCAL_CONFIG.userAgent,
            scraperMode: LOCAL_CONFIG.scraperMode,
            scraperUrls: LOCAL_CONFIG.scraperUrls,
            customSelectors: LOCAL_CONFIG.customSelectors,
            cookies: LOCAL_CONFIG.cookies
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
 */
export async function handleDataOutput(data, config, Actor, isApify) {
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
            specialists: data
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
