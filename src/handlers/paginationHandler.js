/**
 * Pagination handling utilities
 */

import { shouldCrawlUrl } from '../utils/helpers.js';

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
            console.log('No next button found on this page');
            return false;
        }
        
        console.log('Next button found on page');
        
        const isDisabled = await page.evaluate((selector) => {
            const nextBtn = document.querySelector(selector);
            return nextBtn ? nextBtn.classList.contains('disabled') : true;
        }, config.SELECTORS.nextButtonContainer);
        
        console.log(`Next button disabled status: ${isDisabled}`);
        
        return !isDisabled;
    } catch (error) {
        console.error('Error checking next page:', error);
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
        
        console.log(`Current page: ${currentPage}, next page URL: ${nextPageUrl}`);
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
            console.log(`Enqueuing next page: ${nextPageUrl}`);
            
            await enqueueLinks({
                urls: [nextPageUrl],
                label: config.CRAWLER.labels.SPECIALISTS_LIST,
            });
            
            return true;
        } else if (nextPageUrl) {
            console.log(`Next page URL filtered out: ${nextPageUrl}`);
        }
    } else {
        console.log('Next button is disabled - reached last page');
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
            console.log(`Enqueuing page ${nextPageNumber}: ${nextPageUrl}`);
            
            await enqueueLinks({
                urls: [nextPageUrl],
                label: config.CRAWLER.labels.SPECIALISTS_LIST,
            });
            
            return true;
        } else if (nextPageUrl) {
            console.log(`Page ${nextPageNumber} URL filtered out: ${nextPageUrl}`);
        }
    } else {
        console.log('Next button is disabled - no more pages to crawl');
    }
    
    return false;
}