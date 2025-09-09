/**
 * Utility helper functions
 */

/**
 * Format date for filename
 * @param {Date} date - Date object
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
export function formatDateForFilename(date = new Date()) {
    return date.toISOString().split('T')[0];
}

/**
 * Sleep/delay function for rate limiting
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after specified time
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize filename to remove invalid characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * Generate timestamp string
 * @returns {string} Current timestamp in ISO format
 */
export function getCurrentTimestamp() {
    return new Date().toISOString();
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if URL matches any of the allowed patterns
 * @param {string} url - URL to check
 * @param {Array<string>} allowedPatterns - Array of allowed URL patterns (supports wildcards)
 * @returns {boolean} True if URL is allowed
 */
export function isUrlAllowed(url, allowedPatterns) {
    if (!isValidUrl(url) || !allowedPatterns || allowedPatterns.length === 0) {
        return false;
    }
    
    return allowedPatterns.some(pattern => {
        // Convert wildcard pattern to regex
        const regexPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\\\\?\*/g, '.*'); // Convert * to .*
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(url)
    });
}

/**
 * Check if URL matches any of the excluded patterns
 * @param {string} url - URL to check
 * @param {Array<string>} excludedPatterns - Array of excluded URL patterns (supports wildcards)
 * @returns {boolean} True if URL should be excluded
 */
export function isUrlExcluded(url, excludedPatterns) {
    if (!isValidUrl(url) || !excludedPatterns || excludedPatterns.length === 0) {
        return false;
    }
    
    return excludedPatterns.some(pattern => {
        // Convert wildcard pattern to regex
        const regexPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\\\\?\*/g, '.*'); // Convert * to .*
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(url);
    });
}

/**
 * Validate if URL should be crawled based on allowed and excluded patterns
 * @param {string} url - URL to validate
 * @param {Object} config - Configuration object with allowedUrlPatterns and excludedUrlPatterns
 * @returns {boolean} True if URL should be crawled
 */
export function shouldCrawlUrl(url, config) {
    // Check if URL is excluded first
    if (config.excludedUrlPatterns && isUrlExcluded(url, config.excludedUrlPatterns)) {
        console.log(`URL excluded: ${url}`);
        return false;
    }
    
    // Check if URL is allowed
    if (config.allowedUrlPatterns && !isUrlAllowed(url, config.allowedUrlPatterns)) {
        console.log(`URL not in allowed patterns: ${url}`);
        return false;
    }
    
    console.log(`URL allowed: ${url}`);
    return true;
}
