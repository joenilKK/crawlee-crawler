
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';
import fs from 'fs';
import path from 'path';

// Load cookies from JSON file
const loadCookies = () => {
  try {
    const cookiePath = path.join(process.cwd(), 'src', 'recordowl-cookies.json');
    const cookieData = fs.readFileSync(cookiePath, 'utf8');
    return JSON.parse(cookieData);
  } catch (error) {
    console.error('Failed to load cookies:', error);
    return [];
  }
};

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
  sessionPoolOptions: {
    maxPoolSize: 1, // Use single session to maintain state
    sessionOptions: {
      maxAgeSecs: 3600, // 1 hour session
      maxUsageCount: 100, // Allow many requests per session
    },
  },
  
  // Pre-navigation hook to set cookies
  preNavigationHooks: [
    async ({ page, request, log }) => {
      // Load and set cookies for the first request
      if (request.label === 'INITIAL') {
        log.info('Setting authentication cookies...');
        
        const cookies = loadCookies();
        if (cookies.length > 0) {
          // Convert cookie format for Playwright
          const playwrightCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                     cookie.sameSite === 'lax' ? 'Lax' : 
                     cookie.sameSite === 'strict' ? 'Strict' : 'None'
          }));
          
          // Set cookies before navigating
          await page.context().addCookies(playwrightCookies);
          log.info(`Successfully set ${playwrightCookies.length} cookies`);
        } else {
          log.warning('No cookies loaded, proceeding without authentication');
        }
      } else {
        log.info('Using existing session with cookies');
      }
    }
  ],
  
  requestHandler: async ({ page, request, enqueueLinks, log }) => {
    console.log(`Processing: ${request.url}`);
    
    if (request.label === 'DETAIL') {
      const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

      const title = await page.locator('h1.text-xl').textContent();
      // Helper to get text or null if not found
      const getTextOrNull = async (locator) => {
        try {
          const el = await locator.elementHandle();
          if (!el) return null;
          const text = await locator.textContent();
          return text ? text.trim() : null;
        } catch {
          return null;
        }
      };

      const specialist = await getTextOrNull(page.locator('span[itemprop="industry"]'));
      const registrationNumber = await getTextOrNull(page.locator('h3:has-text("General Information") + p.mt-1'));
      const address = await getTextOrNull(page.locator('dt:has-text("Registered Address") + dd.mt-1 a'));
      const status = await getTextOrNull(page.locator('dt:has-text("Operating Status") + dd.mt-1'));
      const companyAge = await getTextOrNull(page.locator('dt.text-sm:has-text("Company Age") + dd.mt-1'));

      const primaryssic = await getTextOrNull(page.locator('dt:has-text("Primary SSIC Code") + dd.mt-1 a'));
      const primaryIndustry = await getTextOrNull(page.locator('dt:has-text("Primary Industry") + dd.mt-1 a'));
      const secondaryssic = await getTextOrNull(page.locator('dt:has-text("Secondary SSIC Code") + dd.mt-1 a'));
      const secondaryIndustry = await getTextOrNull(page.locator('dt:has-text("Secondary Industry") + dd.mt-1 a'));

      const results = {
        url: request.url,
        title,
        "Specialty": specialist,
        "General Information": {
          "Registration Number": registrationNumber,
          "Address": address,
          "Status": status,
          "Company Age": companyAge
        },
        "Industry Classification" : {
          "Primary SSIC Code": primaryssic,
          "Primary Industry": primaryIndustry,
          "Secondary SSIC Code": secondaryssic,
          "Secondary Industry": secondaryIndustry
        }
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
  // Run the crawler with cookie authentication
  await crawler.run([
    { url: 'https://recordowl.com/ssic/clinics-and-other-general-medical-services', label: 'INITIAL' }
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