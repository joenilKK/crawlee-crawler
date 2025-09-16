
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
      const email = await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info a.clinic-item__email').textContent();
      const address = await page.locator('.clinic-item .clinic-item__con:nth-child(2) .clinic-item__info:nth-child(1) span:nth-child(2)').textContent();
      
      const results = {
        url: request.url,
        title,
        speciality,
        telnumber,
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
      const nextButton = await page.$('.pagination-next #nextBtn');
      if (nextButton) {
        await enqueueLinks({
          selector: '.pagination-next #nextBtn',
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
  await crawler.run(['https://www.farrerpark.com/patients-and-visitors/doctor.html']);
  
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