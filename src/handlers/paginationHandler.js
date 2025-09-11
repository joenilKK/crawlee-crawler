/**
 * Pagination handling utilities
 */

import { shouldCrawlUrl } from '../utils/helpers.js';

/**
 * Handle AJAX pagination by clicking next button and waiting for content to load
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<boolean>} True if next page was successfully loaded
 */
export async function handleAjaxPagination(page, config) {
    console.log(`   🔄 Starting AJAX pagination check...`);
    const paginationStartTime = Date.now();
    
    try {
        
        // Check if next button exists and is not disabled
        console.log(`   🔍 Looking for next button with selector: ${config.SELECTORS.nextButton}`);
        const nextButton = await page.$(config.SELECTORS.nextButton);
        if (!nextButton) {
            console.log(`   ❌ Next button not found - no more pages`);
            console.log(`   ⏱️  Pagination check completed in ${Date.now() - paginationStartTime}ms`);
            return false;
        }
        console.log(`   ✅ Next button found`);
        
        // Check if button is disabled
        console.log(`   🔍 Checking if next button is disabled...`);
        const isDisabled = await page.evaluate((selector) => {
            const btn = document.querySelector(selector);
            return btn ? (btn.disabled || btn.classList.contains('disabled') || btn.getAttribute('disabled') !== null) : true;
        }, config.SELECTORS.nextButton);
        
        if (isDisabled) {
            console.log(`   ❌ Next button is disabled - no more pages`);
            console.log(`   ⏱️  Pagination check completed in ${Date.now() - paginationStartTime}ms`);
            return false;
        }
        console.log(`   ✅ Next button is enabled`);
        
        // Add small delay before clicking to ensure button is ready
        console.log(`   ⏳ Adding 1s delay before clicking next button...`);
        await page.waitForTimeout(1000);
        
        // Store current page content to compare after pagination
        console.log(`   📊 Capturing current page content for comparison...`);
        const currentPageContent = await page.evaluate(() => {
            const links = document.querySelectorAll('.list-doctor .list-doctor__item a');
            return Array.from(links).map(link => link.href).sort();
        });
        console.log(`   📊 Current page has ${currentPageContent.length} doctor links`);
        
        
        // Click the next button
        console.log(`   🖱️  Clicking next button...`);
        const clickStartTime = Date.now();
        await nextButton.click();
        console.log(`   ✅ Next button clicked in ${Date.now() - clickStartTime}ms`);
        
        // Wait for processing class to appear on body (indicates AJAX request started)
        console.log(`   ⏳ Waiting for processing indicator to appear: ${config.SELECTORS.processingIndicator}`);
        const processingStartTime = Date.now();
        try {
            await page.waitForSelector(config.SELECTORS.processingIndicator, { 
                timeout: 5000,
                state: 'attached'
            });
            console.log(`   ✅ Processing indicator appeared after ${Date.now() - processingStartTime}ms`);
        } catch (error) {
            console.log(`   ⚠️  Processing indicator not detected after ${Date.now() - processingStartTime}ms - continuing anyway`);
        }
        
        // Wait for processing class to be removed (indicates AJAX request completed)
        console.log(`   ⏳ Waiting for processing indicator to disappear...`);
        const processingEndTime = Date.now();
        try {
            await page.waitForSelector(config.SELECTORS.processingIndicator, { 
                timeout: 30000,
                state: 'detached'
            });
            console.log(`   ✅ Processing indicator disappeared after ${Date.now() - processingEndTime}ms`);
        } catch (error) {
            console.log(`   ⚠️  Processing indicator still present after ${Date.now() - processingEndTime}ms - using fallback delay`);
            // Fallback: wait for a longer time to handle slower responses
            await page.waitForTimeout(5000);
        }
        
        // Additional wait to ensure content is fully loaded
        const additionalDelayMs = config.CRAWLER.ajaxPaginationDelay || 4000;
        console.log(`   ⏳ Adding additional ${additionalDelayMs}ms delay for content stability...`);
        await page.waitForTimeout(additionalDelayMs);
        
        // Verify that page content has actually changed
        console.log(`   🔍 Verifying that page content has changed...`);
        const contentCheckStartTime = Date.now();
        const newPageContent = await page.evaluate(() => {
            const links = document.querySelectorAll('.list-doctor .list-doctor__item a');
            return Array.from(links).map(link => link.href).sort();
        });
        console.log(`   📊 New page has ${newPageContent.length} doctor links (checked in ${Date.now() - contentCheckStartTime}ms)`);
        
        // Check if content actually changed
        const contentChanged = JSON.stringify(currentPageContent) !== JSON.stringify(newPageContent);
        if (!contentChanged) {
            console.log(`   ❌ Page content did not change - pagination may have failed`);
            console.log(`   ⏱️  Pagination attempt completed in ${Date.now() - paginationStartTime}ms`);
            return false;
        }
        
        console.log(`   ✅ Page content changed successfully - pagination successful!`);
        console.log(`   ⏱️  Pagination completed in ${Date.now() - paginationStartTime}ms`);
        return true;
        
    } catch (error) {
        console.error(`   ❌ Error during AJAX pagination:`, error.message);
        console.log(`   ⏱️  Pagination failed after ${Date.now() - paginationStartTime}ms`);
        return false;
    }
}

/**
 * Check if next button exists and is not disabled
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<boolean>} True if next page is available
 */
export async function hasNextPage(page, config) {
    try {
        const nextButton = await page.$(config.SELECTORS.nextButton);
        if (!nextButton) {
            return false;
        }
        
        const isDisabled = await page.evaluate((selector) => {
            const nextBtn = document.querySelector(selector);
            return nextBtn ? nextBtn.classList.contains('disabled') : true;
        }, config.SELECTORS.nextButtonContainer);
        
        return !isDisabled;
    } catch (error) {
        return false;
    }
}

/**
 * Extract current page number from URL based on pagination configuration
 * @param {string} currentUrl - Current page URL
 * @param {Object} config - Configuration object
 * @returns {number} Current page number
 */
export function getCurrentPageNumber(currentUrl, config) {
    try {
        const paginationConfig = config.SITE.pagination;
        
        if (paginationConfig.type === 'query') {
            // Extract page from query parameters
            const url = new URL(currentUrl);
            const pageParam = paginationConfig.queryPattern.split('=')[0]; // Extract parameter name
            return parseInt(url.searchParams.get(pageParam) || paginationConfig.startPage);
        } else if (paginationConfig.type === 'path') {
            // Extract page from URL path
            const pathPattern = paginationConfig.pathPattern.replace('{page}', '(\\d+)');
            const regex = new RegExp(pathPattern);
            const match = currentUrl.match(regex);
            return match ? parseInt(match[1]) : paginationConfig.startPage;
        }
        
        return paginationConfig.startPage;
    } catch (error) {
        console.error('Error extracting current page number:', error);
        return config.SITE.pagination.startPage;
    }
}

/**
 * Generate next page URL based on current page using flexible pagination configuration
 * @param {string} currentUrl - Current page URL
 * @param {Object} config - Configuration object
 * @returns {string} Next page URL
 */
export function getNextPageUrl(currentUrl, config) {
    try {
        const paginationConfig = config.SITE.pagination;
        const currentPage = getCurrentPageNumber(currentUrl, config);
        const nextPage = currentPage + 1;
        
        let nextPageUrl;
        const baseUrl = paginationConfig.baseUrl || config.SITE.startUrl;
        
        if (paginationConfig.type === 'query') {
            // Generate query-based pagination URL
            const url = new URL(baseUrl);
            const queryPattern = paginationConfig.queryPattern.replace('{page}', nextPage);
            const [param, value] = queryPattern.split('=');
            url.searchParams.set(param, value);
            nextPageUrl = url.toString();
        } else if (paginationConfig.type === 'path') {
            // Generate path-based pagination URL
            const pathPattern = paginationConfig.pathPattern.replace('{page}', nextPage);
            
            // Remove trailing slash from base URL if it exists
            const cleanBaseUrl = baseUrl.replace(/\/$/, '');
            nextPageUrl = cleanBaseUrl + pathPattern;
        } else {
            throw new Error(`Unsupported pagination type: ${paginationConfig.type}`);
        }
        
        return nextPageUrl;
    } catch (error) {
        console.error('Error generating next page URL:', error);
        return null;
    }
}

/**
 * Handle pagination for specialist listing pages
 * @param {Page} page - Playwright page object
 * @param {string} currentUrl - Current page URL
 * @param {Function} enqueueLinks - Crawlee enqueueLinks function
 * @param {Object} config - Configuration object
 * @returns {Promise<boolean>} True if next page was enqueued
 */
export async function handlePagination(page, currentUrl, enqueueLinks, config) {
    const hasNext = await hasNextPage(page, config);
    
    if (hasNext) {
        const nextPageUrl = getNextPageUrl(currentUrl, config);
        
        if (nextPageUrl && shouldCrawlUrl(nextPageUrl, config.SITE)) {
            await enqueueLinks({
                urls: [nextPageUrl],
                label: config.CRAWLER.labels.SPECIALISTS_LIST,
            });
            
            return true;
        }
    }
    
    return false;
}

/**
 * Generate page URL for a specific page number using flexible pagination configuration
 * @param {number} pageNumber - Page number to generate URL for
 * @param {Object} config - Configuration object
 * @returns {string} Page URL
 */
export function getPageUrl(pageNumber, config) {
    try {
        const paginationConfig = config.SITE.pagination;
        const baseUrl = paginationConfig.baseUrl || config.SITE.startUrl;
        
        if (paginationConfig.type === 'query') {
            // Generate query-based pagination URL
            const url = new URL(baseUrl);
            const queryPattern = paginationConfig.queryPattern.replace('{page}', pageNumber);
            const [param, value] = queryPattern.split('=');
            url.searchParams.set(param, value);
            return url.toString();
        } else if (paginationConfig.type === 'path') {
            // Generate path-based pagination URL
            const pathPattern = paginationConfig.pathPattern.replace('{page}', pageNumber);
            
            // Remove trailing slash from base URL if it exists
            const cleanBaseUrl = baseUrl.replace(/\/$/, '');
            return cleanBaseUrl + pathPattern;
        } else {
            throw new Error(`Unsupported pagination type: ${paginationConfig.type}`);
        }
    } catch (error) {
        console.error('Error generating page URL:', error);
        return null;
    }
}

/**
 * Handle initial page pagination (page 1 to page 2)
 * @param {Page} page - Playwright page object
 * @param {Function} enqueueLinks - Crawlee enqueueLinks function
 * @param {Object} config - Configuration object
 * @returns {Promise<boolean>} True if page 2 was enqueued
 */
export async function handleInitialPagination(page, enqueueLinks, config) {
    const hasNext = await hasNextPage(page, config);
    
    if (hasNext) {
        const nextPageNumber = config.SITE.pagination.startPage + 1;
        const nextPageUrl = getPageUrl(nextPageNumber, config);
        
        if (nextPageUrl && shouldCrawlUrl(nextPageUrl, config.SITE)) {
            await enqueueLinks({
                urls: [nextPageUrl],
                label: config.CRAWLER.labels.SPECIALISTS_LIST,
            });
            
            return true;
        }
    }
    
    return false;
}