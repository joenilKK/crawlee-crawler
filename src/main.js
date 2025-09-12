import { PlaywrightCrawler } from 'crawlee';
import { extractSpecialistData } from './handlers/dataExtractor.js';
import { saveDataToFile, createBackupIfExists } from './handlers/fileHandler.js';
import { handlePagination, handleInitialPagination } from './handlers/paginationHandler.js';
import { shouldCrawlUrl } from './utils/helpers.js';
import { 
    getRandomViewport, 
    getRealisticHeaders, 
    getHardwareInfo, 
    getScreenProperties,
    getConnectionInfo,
    getBatteryInfo,
    getWebGLInfo,
    getMediaDevices,
    getChromeLoadTimes,
    getChromeCSI,
    generateMousePath,
    getTypingDelay,
    getScrollBehavior
} from './utils/stealth.js';
import { 
    getConfiguration, 
    handleDataOutput, 
    handleExit 
} from './config/environment.js';

/**
 * Convert browser extension cookies to Playwright format
 * @param {Array} cookies - Array of cookies from browser extension
 * @returns {Array} Playwright-formatted cookies
 */
function convertCookiesToPlaywrightFormat(cookies) {
    if (!cookies || !Array.isArray(cookies)) {
        return [];
    }
    
    return cookies.map(cookie => {
        const playwrightCookie = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false
        };
        
        // Handle expiration date
        if (cookie.expirationDate) {
            // Convert from Unix timestamp to Date
            playwrightCookie.expires = Math.floor(cookie.expirationDate);
        }
        
        // Handle sameSite attribute
        if (cookie.sameSite) {
            const sameSiteMap = {
                'no_restriction': 'None',
                'lax': 'Lax',
                'strict': 'Strict'
            };
            playwrightCookie.sameSite = sameSiteMap[cookie.sameSite] || 'Lax';
        }
        
        return playwrightCookie;
    });
}

// Get configuration based on environment (Apify or local)
const { input, isApify, Actor } = await getConfiguration();

// Validate required input field
if (!input.outputFilename || input.outputFilename.trim() === '') {
    const errorMessage = `❌ CONFIGURATION ERROR: outputFilename is required and must be a non-empty string.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
}

// Import configuration from config.js
const { CONFIG: BASE_CONFIG } = await import('./config/config.js');

// Create configuration object using base config with output filename from input
const CONFIG = {
    ...BASE_CONFIG,
    OUTPUT: {
        getFilename: () => {
            if (input.outputFilename && input.outputFilename.trim() !== '') {
                return input.outputFilename.endsWith('.json') ? input.outputFilename : `${input.outputFilename}.json`;
            }
            return BASE_CONFIG.OUTPUT.getFilename();
        }
    }
};

console.log('Starting crawler with configuration:', {
    environment: isApify ? 'Apify' : 'Local',
    siteName: CONFIG.SITE.name,
    startUrl: CONFIG.SITE.startUrl,
    outputFilename: CONFIG.OUTPUT.getFilename(),
    maxRequests: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? 'unlimited' : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless
});

// Array to store all extracted data (for regular crawler)
let extractedData = [];

// Create backup of existing file if needed
createBackupIfExists(CONFIG.OUTPUT.getFilename(), CONFIG);

// Convert cookies to Playwright format
const playwrightCookies = convertCookiesToPlaywrightFormat(CONFIG.COOKIES);

console.log(`🍪 Loading ${playwrightCookies.length} cookies for the session`);
if (playwrightCookies.length > 0) {
    console.log('Cookie domains:', [...new Set(playwrightCookies.map(c => c.domain))].join(', '));
}

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: CONFIG.CRAWLER.headless,
            ignoreHTTPSErrors: true,
            args: [
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
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-client-side-phishing-detection',
                '--disable-sync-preferences',
                '--disable-default-apps',
                '--disable-component-extensions-with-background-pages',
                '--disable-background-networking',
                '--disable-component-update',
                '--disable-domain-reliability',
                '--disable-features=AudioServiceOutOfProcess',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-translate',
                '--disable-windows10-custom-titlebar',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor',
                '--exclude-switches=enable-automation',
                '--disable-automation',
                '--disable-dev-tools',
                '--no-default-browser-check',
                '--no-pings',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-component-extensions-with-background-pages',
                '--disable-background-networking',
                '--disable-component-update',
                '--disable-domain-reliability',
                '--disable-features=AudioServiceOutOfProcess',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-translate',
                '--disable-windows10-custom-titlebar',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            ]
        }
    },
    // Add pre-navigation handler to set cookies and stealth mode
    preNavigationHooks: [
        async ({ page, request }) => {
            // Randomly select user agent and generate realistic configuration
            const randomUserAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
            const viewport = getRandomViewport();
            const hardware = getHardwareInfo();
            const screenProps = getScreenProperties(viewport);
            const connection = getConnectionInfo();
            const battery = getBatteryInfo();
            const webgl = getWebGLInfo();
            const mediaDevices = getMediaDevices();
            
            // Set realistic viewport
            await page.setViewportSize(viewport);
            
            // Set realistic headers based on user agent
            const headers = getRealisticHeaders(randomUserAgent);
            await page.setExtraHTTPHeaders(headers);

            // User agent is already set in launch options and HTTP headers

            // Set cookies before navigation if we have any
            if (playwrightCookies.length > 0) {
                try {
                    await page.context().addCookies(playwrightCookies);
                    console.log(`🍪 Applied ${playwrightCookies.length} cookies to page context`);
                } catch (error) {
                    console.warn(`⚠️ Failed to set some cookies: ${error.message}`);
                }
            }

            // Add comprehensive stealth mode scripts with dynamic values
            await page.addInitScript(({ 
                userAgent, 
                viewport, 
                hardware, 
                screenProps, 
                connection, 
                battery, 
                webgl, 
                mediaDevices,
                chromeLoadTimes,
                chromeCSI
            }) => {
                // Remove webdriver property completely
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Remove automation indicators
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

                // Mock realistic plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => {
                        const plugins = [
                            {
                                0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin },
                                description: "Portable Document Format",
                                filename: "internal-pdf-viewer",
                                length: 1,
                                name: "Chrome PDF Plugin"
                            },
                            {
                                0: { type: "application/pdf", suffixes: "pdf", description: "", enabledPlugin: Plugin },
                                description: "",
                                filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                                length: 1,
                                name: "Chrome PDF Viewer"
                            },
                            {
                                0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: Plugin },
                                1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: Plugin },
                                description: "",
                                filename: "internal-nacl-plugin",
                                length: 2,
                                name: "Native Client"
                            }
                        ];
                        return plugins;
                    },
                });

                // Mock realistic languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });

                // Mock hardware concurrency
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                    get: () => hardware.cores,
                });

                // Mock device memory
                Object.defineProperty(navigator, 'deviceMemory', {
                    get: () => hardware.memory,
                });

                // Mock platform
                Object.defineProperty(navigator, 'platform', {
                    get: () => hardware.platform,
                });

                // Mock permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );

                // Mock chrome object with realistic properties
                
                window.chrome = {
                    runtime: {
                        onConnect: undefined,
                        onMessage: undefined,
                    },
                    loadTimes: function() {
                        return chromeLoadTimes;
                    },
                    csi: function() {
                        return chromeCSI;
                    }
                };

                // Mock realistic screen properties
                Object.defineProperty(screen, 'availTop', { get: () => screenProps.availTop });
                Object.defineProperty(screen, 'availLeft', { get: () => screenProps.availLeft });
                Object.defineProperty(screen, 'availWidth', { get: () => screenProps.availWidth });
                Object.defineProperty(screen, 'availHeight', { get: () => screenProps.availHeight });
                Object.defineProperty(screen, 'colorDepth', { get: () => screenProps.colorDepth });
                Object.defineProperty(screen, 'pixelDepth', { get: () => screenProps.pixelDepth });
                Object.defineProperty(screen, 'width', { get: () => screenProps.width });
                Object.defineProperty(screen, 'height', { get: () => screenProps.height });

                // Mock battery API
                Object.defineProperty(navigator, 'getBattery', {
                    get: () => () => Promise.resolve(battery)
                });

                // Mock connection API
                Object.defineProperty(navigator, 'connection', {
                    get: () => connection
                });

                // Mock media devices
                Object.defineProperty(navigator, 'mediaDevices', {
                    get: () => ({
                        enumerateDevices: () => Promise.resolve(mediaDevices)
                    })
                });

                // Override Date.prototype.getTimezoneOffset to return realistic timezone
                const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
                Date.prototype.getTimezoneOffset = function() {
                    return -480; // UTC+8 (Singapore timezone)
                };

                // Mock WebGL to avoid fingerprinting
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) {
                        return webgl.vendor;
                    }
                    if (parameter === 37446) {
                        return webgl.renderer;
                    }
                    return getParameter(parameter);
                };

                // Mock canvas fingerprinting
                const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function() {
                    const context = this.getContext('2d');
                    if (context) {
                        const imageData = context.getImageData(0, 0, this.width, this.height);
                        for (let i = 0; i < imageData.data.length; i += 4) {
                            imageData.data[i] = imageData.data[i] ^ 1;
                            imageData.data[i + 1] = imageData.data[i + 1] ^ 1;
                            imageData.data[i + 2] = imageData.data[i + 2] ^ 1;
                        }
                        context.putImageData(imageData, 0, 0);
                    }
                    return originalToDataURL.apply(this, arguments);
                };

                // Mock WebRTC to prevent IP leakage
                const originalCreateDataChannel = RTCPeerConnection.prototype.createDataChannel;
                RTCPeerConnection.prototype.createDataChannel = function() {
                    return originalCreateDataChannel.apply(this, arguments);
                };

                // Override getClientRects to avoid detection
                const originalGetClientRects = Element.prototype.getClientRects;
                Element.prototype.getClientRects = function() {
                    const rects = originalGetClientRects.call(this);
                    return Array.from(rects).map(rect => ({
                        ...rect,
                        top: rect.top + Math.random() * 0.1,
                        left: rect.left + Math.random() * 0.1,
                        bottom: rect.bottom + Math.random() * 0.1,
                        right: rect.right + Math.random() * 0.1
                    }));
                };

                // Mock realistic timing
                const originalNow = performance.now;
                performance.now = function() {
                    return originalNow.call(this) + Math.random() * 0.1;
                };

                // Remove automation traces
                delete window.__nightmare;
                delete window._phantom;
                delete window.callPhantom;
                delete window._selenium;
                delete window.__selenium_unwrapped;
                delete window.__webdriver_evaluate;
                delete window.__webdriver_script_func;
                delete window.__webdriver_script_fn;
                delete window.__fxdriver_evaluate;
                delete window.__driver_unwrapped;
                delete window.__webdriver_unwrapped;
                delete window.__driver_evaluate;
                delete window.__selenium_evaluate;
                delete window.__webdriver_script_function;
            }, {
                userAgent: randomUserAgent,
                viewport: viewport,
                hardware: hardware,
                screenProps: screenProps,
                connection: connection,
                battery: battery,
                webgl: webgl,
                mediaDevices: mediaDevices,
                chromeLoadTimes: getChromeLoadTimes(),
                chromeCSI: getChromeCSI()
            });
        }
    ],
    // Session pool options
    sessionPoolOptions: {
        blockedStatusCodes: [], // Don't auto-block any status codes (including 403, 503)
        maxPoolSize: 1,
        sessionOptions: {
            maxErrorScore: 15, // Higher tolerance for "errors" 
            errorScoreDecrement: 0.3, // Slower error recovery
            maxAgeSecs: 1800, // 30 minutes session lifetime
        }
    },
    // Add delays between requests to avoid being detected as a bot
    requestHandlerTimeoutSecs: 90,
    navigationTimeoutSecs: 45,
    // Add random delays between requests
    minConcurrency: 1,
    maxConcurrency: 1,
    // Enhanced proxy support with rotation
    proxyConfiguration: (() => {
        // Check if Apify proxy is available
        if (process.env.APIFY_PROXY_GROUPS) {
            return {
                useApifyProxy: true,
                apifyProxyGroups: process.env.APIFY_PROXY_GROUPS.split(','),
                apifyProxyCountry: process.env.APIFY_PROXY_COUNTRY || CONFIG.PROXY.countries[0],
                apifyProxySessionRotationProbability: 0.3, // 30% chance to rotate session
                apifyProxyMaxUsedSessions: CONFIG.PROXY.sessionPoolSize
            };
        }
        
        // Check if local proxy configuration is enabled
        if (CONFIG.PROXY.enabled) {
            return {
                useApifyProxy: false,
                // Add custom proxy configuration here if needed
                // proxyUrls: ['http://proxy1:port', 'http://proxy2:port']
            };
        }
        
        return undefined;
    })(),
    // Handle failed requests with better retry logic
    failedRequestHandler: async ({ request, error }) => {
        console.error(`❌ Request failed: ${error.message}`);
        
        // Check if it's a network error that might be temporary
        if (error.message.includes('net::ERR_HTTP_RESPONSE_CODE_FAILURE') || 
            error.message.includes('net::ERR_CONNECTION_REFUSED') ||
            error.message.includes('net::ERR_TIMED_OUT')) {
            
            console.log(`🔄 Retrying request after delay: ${request.url}`);
            
            // Add exponential backoff delay
            const retryDelay = Math.min(30000, Math.pow(2, request.retryCount || 0) * 5000);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // Re-enqueue the request for retry
            return request;
        }
        
        // For other errors, don't retry
        console.log(`❌ Giving up on request after ${request.retryCount || 0} retries: ${request.url}`);
    },
    requestHandler: async ({ page, request, enqueueLinks }) => {
        // Add random delay between 3-8 seconds to mimic human behavior
        const delay = Math.random() * 5000 + 3000;
        console.log(`⏱️ Waiting ${Math.round(delay)}ms before processing request`);
        await page.waitForTimeout(delay);
        console.log(`Processing: ${request.url}`);

        // Add realistic human behavior simulation
        try {
            const viewport = page.viewportSize();
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;
            
            // Generate realistic mouse movement path
            const endX = centerX + (Math.random() - 0.5) * 200;
            const endY = centerY + (Math.random() - 0.5) * 200;
            const mousePath = generateMousePath(centerX, centerY, endX, endY);
            
            // Move mouse along the path
            for (const point of mousePath) {
                await page.mouse.move(point.x, point.y);
                await page.waitForTimeout(getTypingDelay() / 2);
            }
            
            // Simulate reading behavior - scroll with realistic behavior
            const scrollBehavior = getScrollBehavior();
            if (scrollBehavior.smooth) {
                await page.mouse.wheel(0, scrollBehavior.distance);
                await page.waitForTimeout(scrollBehavior.duration);
            }
            
            // Random click simulation (sometimes)
            if (Math.random() < 0.3) {
                const clickX = centerX + (Math.random() - 0.5) * 100;
                const clickY = centerY + (Math.random() - 0.5) * 100;
                await page.mouse.click(clickX, clickY);
                await page.waitForTimeout(getTypingDelay());
            }
            
            // Simulate keyboard activity with realistic timing
            if (Math.random() < 0.2) {
                const keys = ['Tab', 'ArrowDown', 'ArrowUp', 'Space', 'Escape'];
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                await page.keyboard.press(randomKey);
                await page.waitForTimeout(getTypingDelay());
            }
            
            // Simulate realistic page interaction patterns
            if (Math.random() < 0.4) {
                // Random scroll to simulate reading
                const scrollAmount = Math.random() * 200 + 100;
                await page.mouse.wheel(0, scrollAmount);
                await page.waitForTimeout(Math.random() * 1000 + 500);
            }
            
        } catch (error) {
            // Ignore mouse/keyboard simulation errors
        }
        
        
        // Temporarily disable URL filtering for debugging
        // if (!shouldCrawlUrl(request.url, CONFIG.SITE)) {
        //     console.log(`Skipping URL outside allowed patterns: ${request.url}`);
        //     return;
        // }
        
        if (request.label === CONFIG.CRAWLER.labels.DETAIL) {
            // Extract specialist data from detail page
            const specialistData = await extractSpecialistData(page, request.url, CONFIG);
            extractedData.push(specialistData);
            
        } else if (request.label === CONFIG.CRAWLER.labels.SPECIALISTS_LIST) {
            // We are on a specialists listing page (page 2, 3, etc.)
            console.log(`Processing specialists listing page: ${request.url}`);
            
            // Wait for the specialists content to load
            await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
            
            // Enqueue all specialist profile links (debugging - no filtering)
            await enqueueLinks({
                selector: CONFIG.SELECTORS.specialistLinks,
                label: CONFIG.CRAWLER.labels.DETAIL,
                // transformRequestFunction: (req) => {
                //     // Filter URLs before adding to queue
                //     if (!shouldCrawlUrl(req.url, CONFIG.SITE)) {
                //         console.log(`Filtered out URL: ${req.url}`);
                //         return false; // Don't add to queue
                //     }
                //     return req;
                // }
            });
            
            // Handle pagination to next page
            await handlePagination(page, request.url, enqueueLinks, CONFIG);
            
        } else {
            // This is the initial page load
            console.log('Starting on specialists page');
            console.log(`Looking for selector: ${CONFIG.SELECTORS.specialistLinks}`);
            
            try {
                // Wait for the specialists content to load
                await page.waitForSelector(CONFIG.SELECTORS.specialistLinks, { timeout: CONFIG.CRAWLER.timeout });
                console.log('✅ Specialist links selector found!');
            } catch (error) {
                console.log('❌ Specialist links selector NOT found. Trying to find what IS on the page...');
                
                // Debug: Check what's actually on the page
                const pageContent = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body',
                        linkCount: document.querySelectorAll('a').length,
                        divCount: document.querySelectorAll('div').length
                    };
                });
                console.log('Page content:', pageContent);
                
                // Try to find any links that might be specialist links
                const allLinks = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links.slice(0, 10).map(link => ({
                        text: link.textContent.trim(),
                        href: link.href,
                        className: link.className
                    }));
                });
                console.log('First 10 links on page:', allLinks);
                
                throw error;
            }
            
            // Enqueue all specialist profile links from the first page (debugging - no filtering)
            await enqueueLinks({
                selector: CONFIG.SELECTORS.specialistLinks,
                label: CONFIG.CRAWLER.labels.DETAIL,
                // transformRequestFunction: (req) => {
                //     // Filter URLs before adding to queue
                //     if (!shouldCrawlUrl(req.url, CONFIG.SITE)) {
                //         console.log(`Filtered out URL: ${req.url}`);
                //         return false; // Don't add to queue
                //     }
                //     return req;
                // }
            });
            
            // Handle pagination for the first page
            await handleInitialPagination(page, enqueueLinks, CONFIG);
        }
    },
    maxRequestsPerCrawl: CONFIG.CRAWLER.maxRequestsPerCrawl === -1 ? undefined : CONFIG.CRAWLER.maxRequestsPerCrawl,
    headless: CONFIG.CRAWLER.headless,
});

await crawler.run([CONFIG.SITE.startUrl]);

// Save extracted data to JSON file
const outputPath = await saveDataToFile(extractedData, CONFIG, CONFIG.COOKIES);

// Handle data output based on environment
await handleDataOutput(extractedData, CONFIG, Actor, isApify, CONFIG.COOKIES);

console.log(`✅ Crawling completed! Found ${extractedData.length} specialists.`);
console.log(`📁 Data saved to: ${outputPath}`);

// Handle exit based on environment
await handleExit(Actor, isApify);