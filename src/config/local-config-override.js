/**
 * Local configuration overrides
 * This file allows you to override specific settings without modifying the main config
 */

export const LOCAL_CONFIG_OVERRIDE = {
    // Process unlimited entities to continue from where we left off
    maxRequestsPerCrawl: -1, // Process unlimited entities
    
    // More conservative timing to avoid server overload
    requestInterval: 8000, // 8 seconds between entities
    pageInterval: 15000, // 15 seconds between pages
    entityInterval: 5000, // 5 seconds after each entity
    
    // Increased timeouts for stability
    timeout: 180000, // 3 minutes per request
    
    // More retries for failed requests
    maxRetries: 5,
};
