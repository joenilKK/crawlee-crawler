
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';

// Initialize the Actor first
await Actor.init();

// Create proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'SG',
});

// Session pool will be created automatically by PlaywrightCrawler

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
  
  // Session rotation configuration
  useSessionPool: true,
  sessionPoolOptions: {
    maxPoolSize: 10,
    sessionOptions: {
      maxAgeSecs: 300, // 5 minutes
      maxUsageCount: 50,
    },
  },
  
  // Additional anti-detection measures
  preNavigationHooks: [
    async ({ page, request, session }) => {
      // Set random user agent for each session
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
      ];
      
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUserAgent);
      
      // Add random delay between requests
      const delay = Math.random() * 2000 + 1000; // 1-3 seconds
      await page.waitForTimeout(delay);
      
      // Set viewport size
      await page.setViewportSize({ width: 1920, height: 1080 });
    }
  ],
  
  requestHandler: async ({ page, request, enqueueLinks, session }) => {
    try {
      console.log(`Processing: ${request.url} with session: ${session?.id || 'no-session'}`);
      
      if (request.label === 'DETAIL') {
      const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

      const title = await page.locator('#Overview > .card-body h1').textContent();
      // Extract UEN and Company Name from the corporate profile section
      const uen = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("UEN") + span').textContent();
      const companyName = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("Company Name") + span').textContent();
      const dateIncorporation = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("Date Incorporation") + span').textContent();
      const status = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("Operating Status") + span').textContent();
      const registrationType = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("Registration Type") + span').textContent();

      let formerNamesList = [];
      const formerNamesLocator = page.locator('#Company-Name-History span[data-info="formerlyKnownAs"]');
      const hasFormerNames = await formerNamesLocator.count() > 0;
      if (hasFormerNames) {
        const formerNames = await formerNamesLocator.allTextContents();
        for (const name of formerNames) {
          if (name && name.trim()) {
            formerNamesList.push(name.trim());
          }
        }
      } else {
        formerNamesList = null; // or [] if you prefer empty array
      }

      const addressSpans = await page.locator('#Contact-Information > .card-body > .list-group label:text("Registered Address") + span > span');
      const address = (await addressSpans.allTextContents()).map(s => s.trim()).filter(Boolean).join(' ');
      const industry = await page.locator('#Company-Industry > .card-body > .list-group label:text("Principal Activity SSIC Code") + span').textContent();
      const principalssic = await page.locator('#Company-Industry > .card-body > .list-group label:text("Principal Activity") + span a').textContent();
      const results = {
        url: request.url,
        title,
        "Company Overview": {
            address: address,
            "UEN": uen,
            "Company Name": companyName,
            "Date Incorporation": dateIncorporation,
            "Operating Status": status,
            "Registration Type": registrationType,
            "Former Names": formerNamesList
        },
        "Company Industry (SSIC)": {
            "Principal Activity SSIC Code": industry,
            "Principal Activity": principalssic
        }
      };


      // Save each URL as a separate object to the dataset
      await Dataset.pushData(results);
      console.log(`Saved data for: ${request.url}`);
    } else {
      // We are now on a category page. We can use this to paginate through and enqueue all products,
      // as well as any subsequent pages we find

      await page.waitForSelector('body > .container > .row > .col-12 > .card > .list-group > a');
      await enqueueLinks({
        selector: 'body > .container > .row > .col-12 > .card > .list-group > a',
        label: 'DETAIL', // <= note the different label
      });

      // Now we need to find the "Next" button and enqueue the next page of results (if it exists)
      const nextButton = await page.$('body > .container > .row > .col-12 > nav .pagination .page-item a.page-link[title="next"]');
      if (nextButton) {
        await enqueueLinks({
          selector: 'body > .container > .row > .col-12 > nav .pagination .page-item a.page-link[title="next"]',
          label: 'CATEGORY', // <= note the same label
        });
      }
      }
    } catch (error) {
      console.error(`Error processing ${request.url}:`, error);
      
      // Mark session as bad if there's a critical error
      if (session && (error.message.includes('blocked') || error.message.includes('captcha') || error.message.includes('403'))) {
        session.markBad();
        console.log(`Marked session ${session.id} as bad due to error: ${error.message}`);
      }
      
      throw error; // Re-throw to let Crawlee handle retries
    }
  },

  // Let's limit our crawls to make our tests shorter and safer.
  //maxRequestsPerCrawl: 5,
});

try {
  // Run the crawler
  await crawler.run(['https://www.sgpbusiness.com/activities/industrial-classification/Health-And-Social-Services/Health-Services/Medical-And-Dental-Practice-Activities/Medical-And-Dental-Practice-Activities/Clinics-And-Other-General-Medical-Services-Western/principal/1']);
  
  // Get the dataset info
  const dataset = await Dataset.open();
  const datasetInfo = await dataset.getInfo();
  console.log(`Crawling completed. Dataset contains ${datasetInfo.itemCount} items.`);
  
} catch (error) {
  console.error('Crawling failed:', error);
  await Actor.fail(error);
} finally {
  // Session pool cleanup is handled automatically by PlaywrightCrawler
  await Actor.exit();
}

//