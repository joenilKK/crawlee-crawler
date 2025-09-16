
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';

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
  
  requestHandler: async ({ page, request, enqueueLinks }) => {

    console.log(`Processing: ${request.url}`);
    if (request.label === 'DETAIL') {
      const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

      const title = await page.locator('#Overview > .card-body h1').textContent();
      // Extract UEN and Company Name from the corporate profile section
      const uen = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("UEN") + span').textContent();
      const companyName = await page.locator('#Corporate-Profile > .card-body > .list-group label:text("Company Name") + span').textContent();

      
      const results = {
        url: request.url,
        title,
      "company overview": [
        {
          "UEN": uen,
          "Company Name": companyName
        }
      ]
      };


      // Save each URL as a separate object to the dataset
      await Dataset.pushData(results);
      console.log(`Saved data for: ${request.url}`);
    } else {
      // We are now on a category page. We can use this to paginate through and enqueue all products,
      // as well as any subsequent pages we find

      await page.waitForSelector('body > .container > .row > .col-12.col-md-6 > .card > .list-group > a');
      await enqueueLinks({
        selector: 'body > .container > .row > .col-12.col-md-6 > .card > .list-group > a',
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
  // Run the crawler
  await crawler.run(['https://www.sgpbusiness.com/activities/industrial-classification/Health-And-Social-Services/Health-Services/Medical-And-Dental-Practice-Activities/Medical-And-Dental-Practice-Activities/Clinics-And-Other-General-Medical-Services-Western']);
  
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