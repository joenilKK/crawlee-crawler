/**
 * Cloudflare bypass utilities
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * Configure browser for Cloudflare bypass
 * @param {Object} config - Configuration object
 * @returns {Object} Browser launch options
 */
export function getCloudflareBypassOptions(config) {
    const options = {
        headless: config.CRAWLER.headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-features=VizDisplayCompositor',
        ]
    };

    // Add stealth options for Cloudflare bypass
    if (config.CLOUDFLARE?.enabled) {
        options.args.push(
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-features=TranslateUI',
            '--disable-features=BlinkGenPropertyTrees',
            '--no-first-run',
            '--disable-features=VizDisplayCompositor'
        );
    }

    return options;
}

/**
 * Setup stealth mode for browser context
 * @param {BrowserContext} context - Browser context
 * @param {Object} config - Configuration object
 */
export async function setupStealthMode(context, config) {
    if (!config.CLOUDFLARE?.enabled) return;

    // Set custom user agent
    if (config.CLOUDFLARE.userAgent) {
        await context.setExtraHTTPHeaders({
            'User-Agent': config.CLOUDFLARE.userAgent
        });
    }

    // Add stealth scripts to all pages
    await context.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Mock chrome runtime
        window.chrome = {
            runtime: {},
        };

        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
    });
}

/**
 * Setup undetected mode with custom headers and behavior
 * @param {Page} page - Playwright page
 * @param {Object} config - Configuration object
 */
export async function setupUndetectedMode(page, config) {
    if (!config.CLOUDFLARE?.enabled) return;

    // Set realistic viewport
    await page.setViewportSize({ width: 1366, height: 768 });

    // Set custom headers
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': config.CLOUDFLARE.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Add realistic mouse movements and timing
    await page.evaluateOnNewDocument(() => {
        // Override the `languages` property to use a custom getter
        Object.defineProperty(navigator, 'languages', {
            get: function() {
                return ['en-US', 'en'];
            }
        });

        // Override the `plugins` property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
            get: function() {
                return [1, 2, 3, 4, 5];
            }
        });

        // Override webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Mock chrome object
        window.chrome = {
            runtime: {}
        };
    });
}

/**
 * Handle Cloudflare challenge detection and bypass
 * @param {Page} page - Playwright page
 * @param {Object} config - Configuration object
 * @returns {Promise<boolean>} True if challenge was handled successfully
 */
export async function handleCloudflareChallenge(page, config) {
    if (!config.CLOUDFLARE?.enabled) return true;

    try {
        // Check for Cloudflare challenge indicators
        const challengeSelectors = [
            '[data-ray]', // Cloudflare ray ID
            '.cf-browser-verification', // Browser verification
            '#cf-challenge-stage', // Challenge stage
            '.cf-checking-browser', // Checking browser
            'div[class*="cf-"]', // Any Cloudflare div
            'title:has-text("Just a moment")', // Common Cloudflare title
            'h1:has-text("Checking your browser")', // Another common text
        ];

        let challengeDetected = false;
        for (const selector of challengeSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    challengeDetected = true;
                    console.log(`🛡️ Cloudflare challenge detected with selector: ${selector}`);
                    break;
                }
            } catch (error) {
                // Continue checking other selectors
            }
        }

        if (challengeDetected) {
            console.log('⏳ Waiting for Cloudflare challenge to complete...');
            
            // Wait for challenge to complete
            await page.waitForTimeout(config.CLOUDFLARE.waitTime || 10000);
            
            // Check if challenge was completed by looking for absence of challenge elements
            let challengeCompleted = true;
            for (const selector of challengeSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        challengeCompleted = false;
                        break;
                    }
                } catch (error) {
                    // Selector not found, which is good
                }
            }

            if (challengeCompleted) {
                console.log('✅ Cloudflare challenge completed successfully');
                return true;
            } else {
                console.log('❌ Cloudflare challenge still active');
                return false;
            }
        }

        return true; // No challenge detected
    } catch (error) {
        console.error('Error handling Cloudflare challenge:', error);
        return false;
    }
}

/**
 * Retry request with Cloudflare bypass
 * @param {Page} page - Playwright page
 * @param {string} url - URL to navigate to
 * @param {Object} config - Configuration object
 * @returns {Promise<boolean>} True if successful
 */
export async function retryWithCloudflareBypass(page, url, config) {
    if (!config.CLOUDFLARE?.enabled) {
        await page.goto(url, { waitUntil: 'networkidle' });
        return true;
    }

    const maxRetries = config.CLOUDFLARE.retries || 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries} to load: ${url}`);
            
            // Setup bypass mode for this attempt
            if (config.CLOUDFLARE.method === 'undetected' || config.CLOUDFLARE.method === 'both') {
                await setupUndetectedMode(page, config);
            }

            // Navigate to the page
            await page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: config.CRAWLER.timeout 
            });

            // Handle potential Cloudflare challenge
            const challengeHandled = await handleCloudflareChallenge(page, config);
            
            if (challengeHandled) {
                // Additional wait to ensure page is fully loaded
                await page.waitForTimeout(2000);
                console.log(`✅ Successfully loaded page on attempt ${attempt}`);
                return true;
            } else {
                console.log(`❌ Attempt ${attempt} failed - Cloudflare challenge not resolved`);
                if (attempt < maxRetries) {
                    await page.waitForTimeout(5000); // Wait before retry
                }
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempt} failed with error:`, error.message);
            if (attempt < maxRetries) {
                await page.waitForTimeout(5000); // Wait before retry
            }
        }
    }
    
    throw new Error(`Failed to bypass Cloudflare after ${maxRetries} attempts`);
}
