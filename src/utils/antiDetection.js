/**
 * Anti-Detection utilities for web scraping
 * Implements multiple layers of protection against browser fingerprinting and bot detection
 */

/**
 * Generate random user agents from a pool of realistic browsers
 */
export function getRandomUserAgent() {
    const userAgents = [
        // Chrome on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        
        // Chrome on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        
        // Firefox on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        
        // Firefox on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
        
        // Safari on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
        
        // Edge on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Generate random viewport sizes
 */
export function getRandomViewport() {
    const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 1600, height: 900 },
        { width: 2560, height: 1440 },
        { width: 1680, height: 1050 }
    ];
    
    return viewports[Math.floor(Math.random() * viewports.length)];
}

/**
 * Generate random screen resolution
 */
export function getRandomScreenResolution() {
    const resolutions = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 2560, height: 1440 },
        { width: 1680, height: 1050 },
        { width: 3840, height: 2160 }
    ];
    
    return resolutions[Math.floor(Math.random() * resolutions.length)];
}

/**
 * Generate random timezone
 */
export function getRandomTimezone() {
    const timezones = [
        'America/New_York',
        'America/Los_Angeles',
        'America/Chicago',
        'America/Denver',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Asia/Singapore',
        'Australia/Sydney',
        'Australia/Melbourne'
    ];
    
    return timezones[Math.floor(Math.random() * timezones.length)];
}

/**
 * Generate random language preferences
 */
export function getRandomLanguages() {
    const languageSets = [
        ['en-US', 'en'],
        ['en-GB', 'en'],
        ['en-CA', 'en'],
        ['en-AU', 'en'],
        ['de-DE', 'de'],
        ['fr-FR', 'fr'],
        ['es-ES', 'es'],
        ['ja-JP', 'ja'],
        ['zh-CN', 'zh'],
        ['ko-KR', 'ko']
    ];
    
    return languageSets[Math.floor(Math.random() * languageSets.length)];
}

/**
 * Generate random browser fingerprint data
 */
export function generateBrowserFingerprint() {
    const viewport = getRandomViewport();
    const screen = getRandomScreenResolution();
    const languages = getRandomLanguages();
    
    return {
        userAgent: getRandomUserAgent(),
        viewport: viewport,
        screen: screen,
        timezone: getRandomTimezone(),
        languages: languages,
        platform: Math.random() > 0.5 ? 'Win32' : 'MacIntel',
        cookieEnabled: true,
        doNotTrack: Math.random() > 0.7 ? '1' : '0',
        hardwareConcurrency: Math.floor(Math.random() * 8) + 4,
        deviceMemory: Math.floor(Math.random() * 8) + 4,
        maxTouchPoints: Math.random() > 0.8 ? 0 : Math.floor(Math.random() * 5)
    };
}

/**
 * Generate random request headers
 */
export function getRandomHeaders(fingerprint) {
    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': fingerprint.languages.join(',') + ';q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': fingerprint.doNotTrack,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    };
    
    // Randomly add some optional headers
    if (Math.random() > 0.5) {
        headers['Sec-Ch-Ua'] = '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"';
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Platform'] = `"${fingerprint.platform === 'Win32' ? 'Windows' : 'macOS'}"`;
    }
    
    return headers;
}

/**
 * Generate random delays with human-like patterns
 */
export function getHumanLikeDelay(baseDelay = 2000, variation = 0.5) {
    // Add some randomness to make delays more human-like
    const randomFactor = 1 + (Math.random() - 0.5) * variation;
    const delay = Math.floor(baseDelay * randomFactor);
    
    // Add occasional longer pauses (human behavior)
    if (Math.random() < 0.1) {
        return delay + Math.floor(Math.random() * 5000) + 2000;
    }
    
    return delay;
}

/**
 * Simulate human-like mouse movements
 */
export async function simulateHumanMouseMovement(page) {
    try {
        const viewport = page.viewportSize();
        if (!viewport) return;
        
        // Random number of movements (1-3)
        const numMovements = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numMovements; i++) {
            const x = Math.floor(Math.random() * viewport.width);
            const y = Math.floor(Math.random() * viewport.height);
            
            await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
            await page.waitForTimeout(Math.floor(Math.random() * 500) + 100);
        }
    } catch (error) {
        // Silently handle mouse movement errors
    }
}

/**
 * Simulate human-like scrolling
 */
export async function simulateHumanScrolling(page) {
    try {
        const viewport = page.viewportSize();
        if (!viewport) return;
        
        // Random scroll behavior
        const scrollAmount = Math.floor(Math.random() * 500) + 200;
        const scrollSteps = Math.floor(Math.random() * 5) + 2;
        
        for (let i = 0; i < scrollSteps; i++) {
            await page.mouse.wheel(0, scrollAmount / scrollSteps);
            await page.waitForTimeout(Math.floor(Math.random() * 300) + 100);
        }
        
        // Sometimes scroll back up a bit
        if (Math.random() > 0.7) {
            await page.mouse.wheel(0, -Math.floor(scrollAmount * 0.3));
            await page.waitForTimeout(Math.floor(Math.random() * 200) + 100);
        }
    } catch (error) {
        // Silently handle scrolling errors
    }
}

/**
 * Inject stealth scripts to hide automation
 */
export async function injectStealthScripts(page) {
    try {
        await page.addInitScript(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Mock chrome object
            if (!window.chrome) {
                window.chrome = {
                    runtime: {},
                };
            }
            
            // Override getParameter to avoid detection
            const originalGetParameter = WebGLRenderingContext.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return originalGetParameter(parameter);
            };
            
            // Mock battery API
            Object.defineProperty(navigator, 'getBattery', {
                get: () => () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 1
                }),
            });
            
            // Override Date.prototype.getTimezoneOffset
            const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            Date.prototype.getTimezoneOffset = function() {
                return -480; // Random timezone offset
            };
            
            // Mock screen properties
            Object.defineProperty(screen, 'availHeight', {
                get: () => screen.height - 40,
            });
            Object.defineProperty(screen, 'availWidth', {
                get: () => screen.width,
            });
            
            // Remove automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });
    } catch (error) {
        // Silently handle script injection errors
    }
}

/**
 * Configure browser to avoid detection
 */
export function getStealthBrowserArgs() {
    return [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--disable-windows10-custom-titlebar',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-default-apps',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-features=TranslateUI',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--disable-translate',
        '--disable-windows10-custom-titlebar',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-blink-features=AutomationControlled'
    ];
}

/**
 * Create a stealth page configuration
 */
export async function configureStealthPage(page, fingerprint) {
    try {
        // Set viewport
        await page.setViewportSize(fingerprint.viewport);
        
        // Set user agent
        await page.setExtraHTTPHeaders({
            'User-Agent': fingerprint.userAgent
        });
        
        // Set additional headers
        const headers = getRandomHeaders(fingerprint);
        await page.setExtraHTTPHeaders(headers);
        
        // Inject stealth scripts
        await injectStealthScripts(page);
        
        // Override navigator properties
        await page.evaluateOnNewDocument((fp) => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            Object.defineProperty(navigator, 'platform', {
                get: () => fp.platform,
            });
            
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => fp.hardwareConcurrency,
            });
            
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => fp.deviceMemory,
            });
            
            Object.defineProperty(navigator, 'maxTouchPoints', {
                get: () => fp.maxTouchPoints,
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => fp.languages,
            });
            
            Object.defineProperty(navigator, 'cookieEnabled', {
                get: () => fp.cookieEnabled,
            });
            
            Object.defineProperty(navigator, 'doNotTrack', {
                get: () => fp.doNotTrack,
            });
            
            // Override screen properties
            Object.defineProperty(screen, 'width', {
                get: () => fp.screen.width,
            });
            Object.defineProperty(screen, 'height', {
                get: () => fp.screen.height,
            });
            Object.defineProperty(screen, 'availWidth', {
                get: () => fp.screen.width,
            });
            Object.defineProperty(screen, 'availHeight', {
                get: () => fp.screen.height - 40,
            });
            
            // Override timezone
            const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            Date.prototype.getTimezoneOffset = function() {
                const timezoneOffsets = {
                    'America/New_York': 300,
                    'America/Los_Angeles': 480,
                    'America/Chicago': 360,
                    'Europe/London': 0,
                    'Europe/Paris': -60,
                    'Asia/Tokyo': -540,
                    'Asia/Singapore': -480
                };
                return timezoneOffsets[fp.timezone] || -480;
            };
        }, fingerprint);
        
    } catch (error) {
        // Silently handle configuration errors
    }
}

/**
 * Simulate human-like page interaction
 */
export async function simulateHumanInteraction(page) {
    try {
        // Random chance to perform human-like actions
        if (Math.random() > 0.3) {
            await simulateHumanMouseMovement(page);
        }
        
        if (Math.random() > 0.5) {
            await simulateHumanScrolling(page);
        }
        
        // Random pause
        const pauseTime = getHumanLikeDelay(1000, 0.3);
        await page.waitForTimeout(pauseTime);
        
    } catch (error) {
        // Silently handle interaction errors
    }
}

/**
 * Generate random proxy configuration (placeholder for future implementation)
 */
export function getRandomProxy() {
    // This would be implemented with actual proxy rotation
    // For now, return null to use direct connection
    return null;
}

/**
 * Check if page is showing bot detection
 */
export async function detectBotProtection(page) {
    try {
        const indicators = await page.evaluate(() => {
            const bodyText = document.body.textContent.toLowerCase();
            const title = document.title.toLowerCase();
            
            return {
                hasCloudflare: bodyText.includes('cloudflare') || title.includes('cloudflare'),
                hasRecaptcha: bodyText.includes('recaptcha') || document.querySelector('[data-sitekey]'),
                hasAccessDenied: bodyText.includes('access denied') || title.includes('access denied'),
                hasBlocked: bodyText.includes('blocked') || bodyText.includes('forbidden'),
                hasBotDetection: bodyText.includes('bot') || bodyText.includes('automated'),
                hasRateLimit: bodyText.includes('rate limit') || bodyText.includes('too many requests'),
                hasMinimalContent: document.body.textContent.trim().length < 500,
                hasRedirect: window.location.href !== document.URL
            };
        });
        
        return Object.values(indicators).some(Boolean);
    } catch (error) {
        return false;
    }
}

/**
 * Handle bot detection by implementing countermeasures
 */
export async function handleBotDetection(page) {
    try {
        // Wait longer and try to trigger content loading
        await page.waitForTimeout(getHumanLikeDelay(5000, 0.5));
        
        // Try scrolling to trigger lazy loading
        await simulateHumanScrolling(page);
        
        // Try clicking on potential "Load More" buttons
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, a, div[role="button"]');
            for (const btn of buttons) {
                const text = btn.textContent.toLowerCase();
                if (text.includes('load') || text.includes('show') || text.includes('more') || text.includes('continue')) {
                    btn.click();
                    break;
                }
            }
        });
        
        // Wait for potential content to load
        await page.waitForTimeout(getHumanLikeDelay(3000, 0.3));
        
    } catch (error) {
        // Silently handle detection countermeasures
    }
}
