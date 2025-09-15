/**
 * Proxy Manager for Crawlee Playwright Crawler
 * Handles proxy rotation, retry logic, and health checking
 */

export class ProxyManager {
    constructor(config) {
        this.config = config;
        this.proxyUrls = [...(config.proxy?.urls || [])];
        this.currentProxyIndex = 0;
        this.failedProxies = new Map(); // Track failed proxies with timestamps
        this.proxyStats = new Map(); // Track proxy usage statistics
        this.lastHealthCheck = 0;
        
        // Validate proxy configuration
        this.validateConfig();
    }

    /**
     * Validate proxy configuration
     */
    validateConfig() {
        if (!this.config.proxy?.enabled) {
            console.log('🔧 Proxy is disabled in configuration');
            return;
        }

        if (!this.proxyUrls.length) {
            console.warn('⚠️ Proxy is enabled but no proxy URLs provided');
            return;
        }

        // Validate proxy URLs
        const validUrls = this.proxyUrls.filter(url => {
            try {
                new URL(url);
                return true;
            } catch {
                console.warn(`⚠️ Invalid proxy URL: ${url}`);
                return false;
            }
        });

        if (validUrls.length !== this.proxyUrls.length) {
            console.warn(`⚠️ ${this.proxyUrls.length - validUrls.length} invalid proxy URLs removed`);
            this.proxyUrls = validUrls;
        }

        console.log(`🌐 Proxy Manager initialized with ${this.proxyUrls.length} proxy URLs`);
        console.log(`🔄 Proxy rotation: ${this.config.proxy?.rotation || 'perRequest'}`);
        console.log(`🌍 Proxy country: ${this.config.proxy?.country || 'US'}`);
    }

    /**
     * Get the next available proxy
     * @param {string} rotationType - Type of rotation (perRequest, perPage, perSession)
     * @returns {string|null} - Proxy URL or null if no proxies available
     */
    getNextProxy(rotationType = 'perRequest') {
        if (!this.config.proxy?.enabled || !this.proxyUrls.length) {
            return null;
        }

        // Clean up expired blacklisted proxies
        this.cleanupBlacklistedProxies();

        // Get available proxies (not blacklisted)
        const availableProxies = this.proxyUrls.filter(url => !this.failedProxies.has(url));
        
        if (!availableProxies.length) {
            console.warn('⚠️ No available proxies - all are blacklisted');
            return null;
        }

        let selectedProxy;
        
        switch (rotationType) {
            case 'perRequest':
                // Round-robin selection
                selectedProxy = availableProxies[this.currentProxyIndex % availableProxies.length];
                this.currentProxyIndex = (this.currentProxyIndex + 1) % availableProxies.length;
                break;
                
            case 'perPage':
                // Use same proxy for entire page
                if (!this.currentPageProxy) {
                    this.currentPageProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
                }
                selectedProxy = this.currentPageProxy;
                break;
                
            case 'perSession':
                // Use same proxy for entire session
                if (!this.sessionProxy) {
                    this.sessionProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
                }
                selectedProxy = this.sessionProxy;
                break;
                
            default:
                selectedProxy = availableProxies[0];
        }

        // Update statistics
        this.updateProxyStats(selectedProxy);
        
        console.log(`🌐 Using proxy: ${this.maskProxyUrl(selectedProxy)}`);
        return selectedProxy;
    }

    /**
     * Mark a proxy as failed and optionally blacklist it
     * @param {string} proxyUrl - The failed proxy URL
     * @param {Error} error - The error that occurred
     */
    markProxyFailed(proxyUrl, error) {
        if (!this.config.proxy?.blacklistFailedProxies) {
            return;
        }

        const now = Date.now();
        this.failedProxies.set(proxyUrl, now);
        
        console.warn(`❌ Proxy failed: ${this.maskProxyUrl(proxyUrl)} - ${error.message}`);
        console.log(`⏰ Proxy blacklisted for ${this.config.proxy?.blacklistDuration || 300000}ms`);
    }

    /**
     * Mark a proxy as successful
     * @param {string} proxyUrl - The successful proxy URL
     */
    markProxySuccess(proxyUrl) {
        // Remove from failed proxies if it was there
        this.failedProxies.delete(proxyUrl);
        
        // Update success statistics
        const stats = this.proxyStats.get(proxyUrl) || { success: 0, failed: 0 };
        stats.success++;
        this.proxyStats.set(proxyUrl, stats);
    }

    /**
     * Clean up expired blacklisted proxies
     */
    cleanupBlacklistedProxies() {
        const now = Date.now();
        const blacklistDuration = this.config.proxy?.blacklistDuration || 300000;
        
        for (const [proxyUrl, failedTime] of this.failedProxies.entries()) {
            if (now - failedTime > blacklistDuration) {
                this.failedProxies.delete(proxyUrl);
                console.log(`✅ Proxy unblacklisted: ${this.maskProxyUrl(proxyUrl)}`);
            }
        }
    }

    /**
     * Update proxy usage statistics
     * @param {string} proxyUrl - The proxy URL
     */
    updateProxyStats(proxyUrl) {
        const stats = this.proxyStats.get(proxyUrl) || { success: 0, failed: 0, lastUsed: 0 };
        stats.lastUsed = Date.now();
        this.proxyStats.set(proxyUrl, stats);
    }

    /**
     * Mask sensitive information in proxy URL for logging
     * @param {string} proxyUrl - The proxy URL to mask
     * @returns {string} - Masked proxy URL
     */
    maskProxyUrl(proxyUrl) {
        try {
            const url = new URL(proxyUrl);
            if (url.username) {
                url.username = '***';
            }
            if (url.password) {
                url.password = '***';
            }
            return url.toString();
        } catch {
            return 'invalid-proxy-url';
        }
    }

    /**
     * Get proxy statistics
     * @returns {Object} - Proxy statistics
     */
    getStats() {
        const stats = {
            totalProxies: this.proxyUrls.length,
            availableProxies: this.proxyUrls.length - this.failedProxies.size,
            blacklistedProxies: this.failedProxies.size,
            proxyDetails: []
        };

        for (const [proxyUrl, proxyStats] of this.proxyStats.entries()) {
            stats.proxyDetails.push({
                url: this.maskProxyUrl(proxyUrl),
                success: proxyStats.success,
                failed: proxyStats.failed,
                successRate: proxyStats.success + proxyStats.failed > 0 
                    ? (proxyStats.success / (proxyStats.success + proxyStats.failed) * 100).toFixed(2) + '%'
                    : 'N/A',
                lastUsed: proxyStats.lastUsed ? new Date(proxyStats.lastUsed).toISOString() : 'Never',
                isBlacklisted: this.failedProxies.has(proxyUrl)
            });
        }

        return stats;
    }

    /**
     * Reset proxy rotation (useful for new page/session)
     */
    resetRotation() {
        this.currentPageProxy = null;
        console.log('🔄 Proxy rotation reset for new page/session');
    }

    /**
     * Check if proxy should be bypassed for a given URL
     * @param {string} url - The URL to check
     * @returns {boolean} - True if proxy should be bypassed
     */
    shouldBypassProxy(url) {
        if (!this.config.proxy?.bypassUrls?.length) {
            return false;
        }

        try {
            const urlObj = new URL(url);
            return this.config.proxy.bypassUrls.some(bypassUrl => 
                urlObj.hostname.includes(bypassUrl) || 
                urlObj.hostname === bypassUrl
            );
        } catch {
            return false;
        }
    }

    /**
     * Get proxy configuration for Playwright
     * @param {string} proxyUrl - The proxy URL to use
     * @returns {Object} - Playwright proxy configuration
     */
    getPlaywrightProxyConfig(proxyUrl) {
        if (!proxyUrl) {
            return {};
        }

        try {
            const url = new URL(proxyUrl);
            const config = {
                server: `${url.protocol}//${url.host}`
            };

            if (url.username && url.password) {
                config.username = url.username;
                config.password = url.password;
            }

            return config;
        } catch (error) {
            console.error('❌ Invalid proxy URL for Playwright:', error.message);
            return {};
        }
    }
}
