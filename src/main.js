
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';

// Initialize the Actor first
await Actor.init();

// Get input configuration
const input = await Actor.getInput();

// Load cookies from input configuration
const loadCookies = () => {
  try {
    const jsonCookie = input?.jsonCookie;
    
    if (!jsonCookie) {
      console.error('No JSON cookie provided in input configuration');
      return [];
    }
    
    // Parse the minified JSON cookie data
    return JSON.parse(jsonCookie);
  } catch (error) {
    console.error('Failed to load cookies from input:', error);
    return [];
  }
};

// Create proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'SG',
});

// Track processed URLs to prevent duplicates
const processedUrls = new Set();

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
    maxPoolSize: 2, // Allow multiple sessions for better concurrency
    sessionOptions: {
      maxAgeSecs: 3600, // 1 hour session
      maxUsageCount: 100, // Allow many requests per session
    },
  },
  
  // Pre-navigation hook to set cookies
  preNavigationHooks: [
    async ({ page, request, log }) => {
      // Load and set cookies for the first request (category page)
      if (request.url === 'https://recordowl.com/ssic/clinics-and-other-general-medical-services') {
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
    
    // Check if URL has already been processed to prevent duplicates
    if (processedUrls.has(request.url)) {
      log.info(`Skipping duplicate URL: ${request.url}`);
      return;
    }
    
    if (request.label === 'DETAIL') {
      // Mark URL as processed
      processedUrls.add(request.url);
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
      // Building Name
      let buildingName = null;
      try {
        buildingName = await getTextOrNull(page.locator('dt:has-text("Building") + dd.mt-1'));
      } catch (e) {
        buildingName = null;
      }

      // Contact Number
      let contactNumberString = null;
      try {
        const contactNumberElement = page
          .locator('dt:has-text("Contact Number") + dd.mt-1')
          .filter({
              hasText: '+',
          })
          .first();
        if (await contactNumberElement.count() > 0) {
          contactNumberString = await contactNumberElement.textContent();
          contactNumberString = contactNumberString ? contactNumberString.trim() : null;
        }
      } catch (e) {
        contactNumberString = null;
      }

      // Company Email
      let companyEmail = null;
      try {
        companyEmail = await getTextOrNull(page.locator('dt:has-text("Email") + dd.mt-1 a'));
      } catch (e) {
        companyEmail = null;
      }

      // Company Website
      let companyWebsite = null;
      try {
        companyWebsite = await getTextOrNull(page.locator('dt:has-text("Website") + dd.mt-1 a'));
      } catch (e) {
        companyWebsite = null;
      }
      // Try to get company age with more specific selector
      let companyAge = null;
      try {
        companyAge = await page.locator('div.block#overview dt:has-text("Company Age") + dd.mt-1').textContent();
      } catch (error) {
        console.log('Error getting company age:', error.message);
      }

      const primaryssic = await getTextOrNull(page.locator('dt:has-text("Primary SSIC Code") + dd.mt-1 a'));
      const primaryIndustry = await getTextOrNull(page.locator('dt:has-text("Primary Industry") + dd.mt-1 a'));
      const secondaryssic = await getTextOrNull(page.locator('dt:has-text("Secondary SSIC Code") + dd.mt-1 a'));
      const secondaryIndustry = await getTextOrNull(page.locator('dt:has-text("Secondary Industry") + dd.mt-1 a'));

      const results = {
        url: request.url,
        title,
        //"Specialty": specialist,
        "General Information": {
          "Registration Number": registrationNumber,
          "Address": address,
          "Status": status,
          "Company Age": companyAge,
          "Building Name": buildingName,
          "Contact Number": contactNumberString,
          "Company Email": companyEmail,
          "Company Website": companyWebsite
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
      
      // Mark category page as processed
      processedUrls.add(request.url);

      await page.waitForSelector('main.bg-white > .mx-auto > .mb-8 > .grid:nth-child(2) > .bg-white a.font-semibold');
      
      // Enqueue detail pages with deduplication
      const detailLinks = await page.locator('main.bg-white > .mx-auto > .mb-8 > .grid:nth-child(2) > .bg-white a.font-semibold').all();
      const newDetailUrls = [];
      
      for (const link of detailLinks) {
        const href = await link.getAttribute('href');
        if (href) {
          // Convert relative URLs to absolute URLs
          const absoluteUrl = href.startsWith('http') ? href : new URL(href, request.url).href;
          if (!processedUrls.has(absoluteUrl)) {
            newDetailUrls.push(absoluteUrl);
          }
        }
      }
      
      // Enqueue new detail URLs
      for (const url of newDetailUrls) {
        await crawler.addRequests([{ url, label: 'DETAIL' }]);
      }
      
      log.info(`Enqueued ${newDetailUrls.length} new detail pages`);

      // Now we need to find the "Next" button and enqueue the next page of results (if it exists)
      const nextButton = await page.$('.isolate a.px-4:has-text("Next")');
      if (nextButton) {
        const nextHref = await nextButton.getAttribute('href');
        if (nextHref) {
          // Convert relative URL to absolute URL
          const absoluteNextUrl = nextHref.startsWith('http') ? nextHref : new URL(nextHref, request.url).href;
          if (!processedUrls.has(absoluteNextUrl)) {
            await crawler.addRequests([{ url: absoluteNextUrl, label: 'CATEGORY' }]);
            log.info(`Enqueued next page: ${absoluteNextUrl}`);
          }
        }
      }
    }
  },

  // Let's limit our crawls to make our tests shorter and safer.
  //maxRequestsPerCrawl: 5,
});

try {
  // Run the crawler with cookie authentication
  await crawler.run([
    { url: 'https://recordowl.com/ssic/clinics-and-other-general-medical-services', label: 'CATEGORY' }
  ]);
  
  // Get the dataset info
  const dataset = await Dataset.open();
  const datasetInfo = await dataset.getInfo();
  console.log(`Crawling completed. Dataset contains ${datasetInfo.itemCount} items.`);
  console.log(`Total URLs processed: ${processedUrls.size}`);
  
} catch (error) {
  console.error('Crawling failed:', error);
  await Actor.fail(error);
} finally {
  await Actor.exit();
}

//