
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';

// Get credentials from environment variables or use defaults
const USERNAME = process.env.CRAWLER_USERNAME || 'growthsge@gmail.com';
const PASSWORD = process.env.CRAWLER_PASSWORD || 'sustainablegrowthexpert';
const LOGIN_URL = process.env.LOGIN_URL || 'https://recordowl.com/login';

// Initialize the Actor first
await Actor.init();

// Create proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'SG',
});

// Track if login has been performed
let isLoggedIn = false;

const crawler = new PlaywrightCrawler({
  // Apify proxy configuration
  proxyConfiguration,
  
  // Browser configuration for Apify
  launchContext: {
    launchOptions: {
      headless: true,
    },
  },
  
  // Request configuration
  requestHandlerTimeoutSecs: 60,
  maxRequestRetries: 3,
  
  // Enable session management to maintain cookies
  useSessionPool: true,
  sessionPoolOptions: {
    maxPoolSize: 1, // Use single session to maintain login state
    sessionOptions: {
      maxAgeSecs: 3600, // 1 hour session
      maxUsageCount: 100, // Allow many requests per session
    },
  },
  
  // Pre-navigation hook to handle authentication
  preNavigationHooks: [
    async ({ page, request, log, session }) => {
      // Check if we need to login (only once per session)
      if (!isLoggedIn && request.label === 'LOGIN') {
        log.info('Performing Google OAuth login...');
        
        // Navigate to login page
        await page.goto(LOGIN_URL);
        
        // Wait for Google login button to appear
        await page.waitForSelector('a[href*="google"], button[data-provider="google"], .google-login, [class*="google"]', { timeout: 15000 });
        
        // Click on Google login button
        await page.click('a[href*="google"], button[data-provider="google"], .google-login, [class*="google"]');
        
        // Wait for Google OAuth page to load
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        
        // Check if we're on Google's OAuth page
        const currentUrl = page.url();
        log.info(`Current URL after Google button click: ${currentUrl}`);
        
        const isGoogleOAuth = currentUrl.includes('accounts.google.com');
        if (isGoogleOAuth) {
          log.info('On Google OAuth page, entering credentials...');
          
          // Wait for email input field
          await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
          
          // Enter email
          await page.fill('input[type="email"], input[name="email"]', USERNAME);
          
          // Click Next button
          await page.click('#identifierNext, button[type="submit"]');
          
          // Wait for password field
          await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });
          
          // Enter password
          await page.fill('input[type="password"], input[name="password"]', PASSWORD);
          
          // Click Next/Sign in button
          await page.click('#passwordNext, button[type="submit"]');
          
          // Wait for OAuth flow to complete and redirect back
          await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
          
          const finalUrl = page.url();
          log.info(`Google OAuth login completed. Final URL: ${finalUrl}`);
          isLoggedIn = true;
        } else {
          // Check if we're already logged in or if it's a different auth flow
          log.info(`Not on Google OAuth page. Current URL: ${currentUrl}`);
          
          // Check if we're already logged in by looking for logout buttons or user profile elements
          const alreadyLoggedIn = await page.$('a[href*="logout"], .logout, .user-profile, .user-menu') !== null;
          if (alreadyLoggedIn) {
            log.info('Already logged in or login completed automatically');
            isLoggedIn = true;
          } else {
            // Fallback to regular form login if Google OAuth button not found
            log.info('Google OAuth not detected, trying regular form login...');
            
            try {
              await page.waitForSelector('input[name="username"], input[name="email"], input[type="email"]', { timeout: 10000 });
              await page.fill('input[name="username"], input[name="email"], input[type="email"]', USERNAME);
              await page.fill('input[name="password"], input[type="password"]', PASSWORD);
              await page.click('button[type="submit"], input[type="submit"], .login-button, #login-button');
              await page.waitForNavigation({ waitUntil: 'networkidle' });
              log.info('Regular form login completed');
              isLoggedIn = true;
            } catch (error) {
              log.warning('Regular form login failed, but continuing with crawl');
            }
          }
        }
      } else if (isLoggedIn) {
        log.info('Using existing session - already logged in');
      }
    }
  ],
  
  requestHandler: async ({ page, request, enqueueLinks, log }) => {
    console.log(`Processing: ${request.url}`);
    
    // Skip login requests in the main handler
    if (request.label === 'LOGIN') {
      return;
    }
    
    // Check if we're still logged in before processing
    if (isLoggedIn) {
      try {
        // Quick check to see if we're still logged in by looking for login indicators
        const isOnLoginPage = page.url().includes('/login');
        const hasLoginForm = await page.$('input[type="password"], input[name="password"]') !== null;
        
        if (isOnLoginPage || hasLoginForm) {
          log.warning('Detected login page, session may have expired. Re-authenticating...');
          isLoggedIn = false;
          // The preNavigationHooks will handle re-login on the next request
        }
      } catch (error) {
        log.warning('Could not verify login status, continuing with request');
      }
    }
    
    if (request.label === 'DETAIL') {
      const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

      const title = await page.locator('h1.text-xl').textContent();
      const results = {
        url: request.url,
        title,
      };


      // Save each URL as a separate object to the dataset
      await Dataset.pushData(results);
      console.log(`Saved data for: ${request.url}`);
    } else {
      // We are now on a category page. We can use this to paginate through and enqueue all products,
      // as well as any subsequent pages we find

      await page.waitForSelector('main.bg-white > .mx-auto > .mb-8 > .grid:nth-child(2) > .bg-white a.font-semibold');
      await enqueueLinks({
        selector: 'main.bg-white > .mx-auto > .mb-8 > .grid:nth-child(2) > .bg-white a.font-semibold',
        label: 'DETAIL', // <= note the different label
      });

      // Now we need to find the "Next" button and enqueue the next page of results (if it exists)
      const nextButton = await page.$('.isolate a.px-4:has-text("Next")');
      if (nextButton) {
        await enqueueLinks({
          selector: '.isolate a.px-4:has-text("Next")',
          label: 'CATEGORY', // <= note the same label
        });
      }
    }
  },

  // Let's limit our crawls to make our tests shorter and safer.
  maxRequestsPerCrawl: 5,
});

try {
  // Run the crawler with login first
  await crawler.run([
    { url: LOGIN_URL, label: 'LOGIN' },
    'https://recordowl.com/ssic/clinics-and-other-general-medical-services'
  ]);
  
  // Get the dataset info
  const dataset = await Dataset.open();
  const datasetInfo = await dataset.getInfo();
  console.log(`Crawling completed. Dataset contains ${datasetInfo.itemCount} items.`);
  
} catch (error) {
  console.error('Crawling failed:', error);
  await Actor.fail(error);
} finally {
  await Actor.exit();
}

//