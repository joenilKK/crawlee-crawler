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
       // console.log('🏢 Running in Apify environment - using Actor input');
        const { Actor } = await import('apify');
        
        // Initialize Actor only in Apify environment
        await Actor.init();
        
        // Get input from Apify Actor
        let input = await Actor.getInput();
        
        // Debug logging
      //  console.log('🔍 Debug - Raw input from Apify:', input);
      //  console.log('🔍 Debug - Input type:', typeof input);
       // console.log('🔍 Debug - Input keys:', input ? Object.keys(input) : 'null');
        
        // If no input is provided or input is empty, use default scraper mode configuration
        // Also handle the case where input exists but has no meaningful data
        if (!input || Object.keys(input).length === 0 || !input.siteName) {
           // console.log('🎯 No input provided - using default scraper mode configuration for MT Alvernia');
            input = {
                siteName: 'MT Alvernia Medical Centre',
                baseUrl: 'https://mtalvernia.sg/',
                startUrl: 'https://mtalvernia.sg/doctors/',
                allowedUrlPatterns: ['https://mtalvernia.sg/doctors/', 'https://mtalvernia.sg/doctors/*'],
                excludedUrlPatterns: [],
                paginationType: 'query',
                queryPattern: 'page={page}',
                pathPattern: '/page/{page}/',
                paginationBaseUrl: null,
                startPage: 1,
                specialistLinksSelector: 'a[href*="doctor"]',
                nextButtonSelector: '.next, .pagination-next, [aria-label="Next"]',
                nextButtonContainerSelector: '.pagination, .pager',
                doctorNameSelector: 'h1, .doctor-name, .name',
                contactLinksSelector: 'a[href*="tel"], a[href*="mailto"], .contact a',
                maxRequestsPerCrawl: 200,
                headless: true,
                timeout: 10000,
                outputFilename: 'mtalvernia-scraped-data',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                manualMode: false,
                scraperMode: true,
                scraperUrls: ['https://mtalvernia.sg/doctors/'],
                customSelectors: {
                    doctorCards: '.doctor',
                    doctorName: 'h4.doctor-name, .left h4',
                    position: '.right > p',
                    phoneLinks: '.tel_number a',
                    Website: '.right p a'
                }
            };
          //  console.log('✅ Default scraper mode configuration applied');
            console.log('🔍 Debug - Final input object:', {
                scraperMode: input.scraperMode,
                siteName: input.siteName,
                scraperUrls: input.scraperUrls
            });
        }
        
        return { input, isApify: true, Actor };
    } else {
      //  console.log('💻 Running in local environment - using local configuration');
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
            manualMode: LOCAL_CONFIG.manualMode,
            scraperMode: LOCAL_CONFIG.scraperMode,
            scraperUrls: LOCAL_CONFIG.scraperUrls,
            customSelectors: LOCAL_CONFIG.customSelectors
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
