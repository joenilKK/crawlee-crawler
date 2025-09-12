/**
 * Proxy Management System for Anti-Detection
 * Handles proxy rotation, validation, and failover
 */

/**
 * Proxy configuration and management
 */
export class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentProxyIndex = 0;
        this.failedProxies = new Set();
        this.proxyStats = new Map();
    }

    /**
     * Add proxy to the pool
     * @param {Object} proxy - Proxy configuration
     */
    addProxy(proxy) {
        if (this.validateProxyConfig(proxy)) {
            this.proxies.push({
                ...proxy,
                id: `${proxy.host}:${proxy.port}`,
                failures: 0,
                lastUsed: null,
                successRate: 1.0
            });
        }
    }

    /**
     * Add multiple proxies at once
     * @param {Array} proxies - Array of proxy configurations
     */
    addProxies(proxies) {
        proxies.forEach(proxy => this.addProxy(proxy));
    }

    /**
     * Validate proxy configuration
     * @param {Object} proxy - Proxy configuration
     * @returns {boolean} True if valid
     */
    validateProxyConfig(proxy) {
        return proxy && 
               proxy.host && 
               proxy.port && 
               typeof proxy.host === 'string' && 
               typeof proxy.port === 'number' &&
               proxy.port > 0 && 
               proxy.port < 65536;
    }

    /**
     * Get next available proxy
     * @returns {Object|null} Proxy configuration or null
     */
    getNextProxy() {
        if (this.proxies.length === 0) {
            return null;
        }

        // Filter out failed proxies
        const availableProxies = this.proxies.filter(proxy => 
            !this.failedProxies.has(proxy.id) && 
            proxy.failures < 3
        );

        if (availableProxies.length === 0) {
            // Reset failed proxies if all are marked as failed
            this.resetFailedProxies();
            return this.proxies[0] || null;
        }

        // Sort by success rate and last used time
        availableProxies.sort((a, b) => {
            if (a.successRate !== b.successRate) {
                return b.successRate - a.successRate;
            }
            if (!a.lastUsed && !b.lastUsed) return 0;
            if (!a.lastUsed) return -1;
            if (!b.lastUsed) return 1;
            return a.lastUsed - b.lastUsed;
        });

        const selectedProxy = availableProxies[0];
        selectedProxy.lastUsed = Date.now();
        return selectedProxy;
    }

    /**
     * Mark proxy as failed
     * @param {string} proxyId - Proxy identifier
     */
    markProxyFailed(proxyId) {
        const proxy = this.proxies.find(p => p.id === proxyId);
        if (proxy) {
            proxy.failures++;
            proxy.successRate = Math.max(0, proxy.successRate - 0.1);
            
            if (proxy.failures >= 3) {
                this.failedProxies.add(proxyId);
            }
        }
    }

    /**
     * Mark proxy as successful
     * @param {string} proxyId - Proxy identifier
     */
    markProxySuccess(proxyId) {
        const proxy = this.proxies.find(p => p.id === proxyId);
        if (proxy) {
            proxy.failures = Math.max(0, proxy.failures - 1);
            proxy.successRate = Math.min(1.0, proxy.successRate + 0.05);
        }
    }

    /**
     * Reset failed proxies
     */
    resetFailedProxies() {
        this.failedProxies.clear();
        this.proxies.forEach(proxy => {
            proxy.failures = 0;
        });
    }

    /**
     * Get proxy statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const total = this.proxies.length;
        const failed = this.failedProxies.size;
        const available = total - failed;
        
        return {
            total,
            available,
            failed,
            successRate: total > 0 ? this.proxies.reduce((sum, p) => sum + p.successRate, 0) / total : 0
        };
    }

    /**
     * Convert proxy to Playwright format
     * @param {Object} proxy - Proxy configuration
     * @returns {Object} Playwright proxy configuration
     */
    toPlaywrightFormat(proxy) {
        if (!proxy) return null;

        const config = {
            server: `http://${proxy.host}:${proxy.port}`
        };

        if (proxy.username && proxy.password) {
            config.username = proxy.username;
            config.password = proxy.password;
        }

        return config;
    }
}

/**
 * Default proxy configurations (free proxies - use with caution)
 * In production, replace with your own proxy service
 */
export const DEFAULT_PROXIES = [
    // Add your proxy configurations here
    // Example:
    // { host: 'proxy1.example.com', port: 8080, username: 'user', password: 'pass' },
    // { host: 'proxy2.example.com', port: 3128 },
];

/**
 * Create proxy manager with default configuration
 * @returns {ProxyManager} Configured proxy manager
 */
export function createProxyManager() {
    const manager = new ProxyManager();
    manager.addProxies(DEFAULT_PROXIES);
    return manager;
}

/**
 * Test proxy connectivity
 * @param {Object} proxy - Proxy configuration
 * @returns {Promise<boolean>} True if proxy is working
 */
export async function testProxy(proxy) {
    try {
        // This would implement actual proxy testing
        // For now, return true as placeholder
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get random proxy from a list
 * @param {Array} proxies - Array of proxy configurations
 * @returns {Object|null} Random proxy or null
 */
export function getRandomProxy(proxies) {
    if (!proxies || proxies.length === 0) {
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
}

/**
 * Rotate proxies based on usage patterns
 * @param {Array} proxies - Array of proxy configurations
 * @param {Object} usageStats - Usage statistics
 * @returns {Object|null} Selected proxy or null
 */
export function rotateProxies(proxies, usageStats = {}) {
    if (!proxies || proxies.length === 0) {
        return null;
    }

    // Sort by least recently used
    const sortedProxies = proxies.sort((a, b) => {
        const aLastUsed = usageStats[a.id]?.lastUsed || 0;
        const bLastUsed = usageStats[b.id]?.lastUsed || 0;
        return aLastUsed - bLastUsed;
    });

    return sortedProxies[0];
}

/**
 * Validate proxy response
 * @param {Response} response - HTTP response
 * @returns {boolean} True if response indicates working proxy
 */
export function validateProxyResponse(response) {
    if (!response) return false;
    
    const status = response.status();
    
    // Consider these status codes as proxy working
    const validStatuses = [200, 201, 202, 204, 301, 302, 303, 307, 308];
    
    // Consider these as proxy issues
    const invalidStatuses = [407, 502, 503, 504];
    
    if (invalidStatuses.includes(status)) {
        return false;
    }
    
    return validStatuses.includes(status) || status < 500;
}

/**
 * Get proxy error message
 * @param {Error} error - Error object
 * @returns {string} Human-readable error message
 */
export function getProxyErrorMessage(error) {
    if (!error) return 'Unknown proxy error';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
        return 'Proxy timeout';
    } else if (message.includes('connection refused')) {
        return 'Proxy connection refused';
    } else if (message.includes('authentication')) {
        return 'Proxy authentication failed';
    } else if (message.includes('forbidden')) {
        return 'Proxy access forbidden';
    } else if (message.includes('not found')) {
        return 'Proxy not found';
    } else {
        return `Proxy error: ${error.message}`;
    }
}
