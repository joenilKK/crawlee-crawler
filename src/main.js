
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
  
  // Pre-navigation hook to handle authentication
  preNavigationHooks: [
    async ({ page, request, log }) => {
      // Only perform login on the first request
      if (request.label === 'LOGIN') {
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
        const isGoogleOAuth = await page.url().includes('accounts.google.com');
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
          
          log.info('Google OAuth login completed successfully');
        } else {
          // Fallback to regular form login if Google OAuth button not found
          log.info('Google OAuth not detected, trying regular form login...');
          
          await page.waitForSelector('input[name="username"], input[name="email"], input[type="email"]', { timeout: 10000 });
          await page.fill('input[name="username"], input[name="email"], input[type="email"]', USERNAME);
          await page.fill('input[name="password"], input[type="password"]', PASSWORD);
          await page.click('button[type="submit"], input[type="submit"], .login-button, #login-button');
          await page.waitForNavigation({ waitUntil: 'networkidle' });
        }
      }
    }
  ],
  
  requestHandler: async ({ page, request, enqueueLinks }) => {

    console.log(`Processing: ${request.url}`);
    if (request.label === 'DETAIL') {
      const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

      const title = await page.locator('.doctor-profile h1').textContent();
      const speciality = await page.locator('.doctor-profile ul li.doctor-profile__item:nth-child(1) .doctor-profile__item-detail span').textContent();
      const languageElements = await page.locator('.doctor-profile ul li.doctor-profile__item:nth-child(2) .doctor-profile__item-detail span');
      const languageCount = await languageElements.count();
      const language = [];
      for (let i = 0; i < languageCount; i++) {
        const lang = await languageElements.nth(i).textContent();
        if (lang) language.push(lang.trim());
      }

      const telnumber = await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info:nth-child(1) a').textContent();
      const faxnumber = await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info:nth-child(2) span:nth-child(2)').textContent();
      const email = await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info a.clinic-item__email').textContent();
      const address = await page.locator('.clinic-item .clinic-item__con:nth-child(2) .clinic-item__info:nth-child(1) span:nth-child(2)').textContent();
      
      const results = {
        url: request.url,
        title,
        speciality,
        telnumber,
        faxnumber,
        email,
        address,
        language,

      };


      // Save each URL as a separate object to the dataset
      await Dataset.pushData(results);
      console.log(`Saved data for: ${request.url}`);
    } else {
      // We are now on a category page. We can use this to paginate through and enqueue all products,
      // as well as any subsequent pages we find

      await page.waitForSelector('.list-doctor .list-doctor__view a.btn-fph');
      await enqueueLinks({
        selector: '.list-doctor .list-doctor__view a.btn-fph',
        label: 'DETAIL', // <= note the different label
      });

      // Now we need to find the "Next" button and enqueue the next page of results (if it exists)
      const nextButton = await page.$('body > .container > .row > .col-12.col-md-6 > nav .pagination .page-item a.page-link[title="next"]');
      if (nextButton) {
        await enqueueLinks({
          selector: 'body > .container > .row > .col-12.col-md-6 > nav .pagination .page-item a.page-link[title="next"]',
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