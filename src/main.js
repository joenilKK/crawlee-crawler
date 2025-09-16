import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor } from 'apify';

// Initialize the Actor first
await Actor.init();

// Create proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'US',
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

      const title = await page.locator('.panel-heading h1').textContent();

      // Get all rows in the #overview table tbody
      const rows = await page.locator('#overview table tbody tr');
      const tableData = [];
      const rowCount = await rows.count();
      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const tds = row.locator('td');
        const key = (await tds.nth(0).textContent())?.trim();
        const value = (await tds.nth(1).textContent())?.trim();
        if (key && value) {
          tableData.push({ title: key, content: value });
        }
      }

      const table_location = await page.locator('#location .panel-body > .col-xs-12.col-sm-6:nth-child(2) table tbody tr');
      const table_location_data = [];
      const table_location_row_count = await table_location.count();
      for (let i = 0; i < table_location_row_count; i++) {
        const table_location_row = table_location.nth(i);
        const table_location_tds = table_location_row.locator('td');
        const table_location_key = (await table_location_tds.nth(0).textContent())?.trim();
        const table_location_value = (await table_location_tds.nth(1).textContent())?.trim();
        if (table_location_key && table_location_value) {
          table_location_data.push({ title: table_location_key, content: table_location_value });
        }
      }



      const results = {
        url: request.url,
        title,
        "Business overview": tableData,
        "Location": table_location_data
      };

      // Save each URL as a separate object to the dataset
      await Dataset.pushData(results);
      console.log(`Saved data for: ${request.url}`);
    } else {
      // We are now on a category page. We can use this to paginate through and enqueue all products,
      // as well as any subsequent pages we find

      await page.waitForSelector('.table td a');
      await enqueueLinks({
        selector: '.table td a',
        label: 'DETAIL', // <= note the different label
      });

      // Now we need to find the "Next" button and enqueue the next page of results (if it exists)
      const nextButton = await page.$('ul.pager li a');
      if (nextButton) {
        await enqueueLinks({
          selector: 'ul.pager li a',
          label: 'CATEGORY', // <= note the same label
        });
      }
    }
  },

  // Let's limit our crawls to make our tests shorter and safer.
 // maxRequestsPerCrawl: 5,
});

try {
  // Run the crawler
  await crawler.run(['https://opengovsg.com/corporate?ssic=86201']);
  
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