
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

      let title = null;
      if (await page.locator('.doctor-profile h1').count() > 0) {
        title = await page.locator('.doctor-profile h1').textContent();
      }

      let speciality = [];
      const specialityElements = await page.locator('.doctor-profile ul li.doctor-profile__item:nth-child(1) .doctor-profile__item-detail span');
      const specialityCount = await specialityElements.count();
      for (let i = 0; i < specialityCount; i++) {
        const spec = await specialityElements.nth(i).textContent();
        if (spec) speciality.push(spec.trim());
      }

      let language = [];
      if (await page.locator('.doctor-profile ul li.doctor-profile__item:nth-child(2) .doctor-profile__item-detail span').count() > 0) {
        const languageElements = await page.locator('.doctor-profile ul li.doctor-profile__item:nth-child(2) .doctor-profile__item-detail span');
        const languageCount = await languageElements.count();
        for (let i = 0; i < languageCount; i++) {
          const lang = await languageElements.nth(i).textContent();
          if (lang) language.push(lang.trim());
        }
      }

      let telnumber = null;
      let email = null;
      let address = null;

      if (await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info:nth-child(1) a').isVisible()) {
        telnumber = await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info:nth-child(1) a').textContent();
      }
      if (await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info a.clinic-item__email').isVisible()) {
        email = await page.locator('.clinic-item .clinic-item__con:nth-child(1) .clinic-item__info a.clinic-item__email').textContent();
      }
      if (await page.locator('.clinic-item .clinic-item__con:nth-child(2) .clinic-item__info:nth-child(1) span:nth-child(2)').isVisible()) {
        address = await page.locator('.clinic-item .clinic-item__con:nth-child(2) .clinic-item__info:nth-child(1) span:nth-child(2)').textContent();
      }
      
      const results = {
        url: request.url,
        title,
        speciality,
        telnumber,
        email,
        address,
        language,
        dateDiscovered: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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

      // Handle AJAX pagination by clicking next button until disabled
      let pageCount = 1;
      let hasNextPage = true;
      
      while (hasNextPage) {
        const nextButton = await page.$('.pagination .pagination-next a#nextBtn');
        
        if (nextButton) {
          // Check if button is disabled
          const isDisabled = await nextButton.evaluate(el => el.classList.contains('disabled') || el.getAttribute('disabled') !== null);
          
          if (isDisabled) {
            console.log('Next button is disabled, pagination complete');
            hasNextPage = false;
            break;
          }
          
          console.log(`Clicking next button for page ${pageCount + 1}...`);
          
          // Click the next button
          await nextButton.click();
          
          // Wait for the processing class to be added to body
          await page.waitForSelector('body.processing', { timeout: 5000 }).catch(() => {
            console.log('Processing class not found, continuing...');
          });
          
          // Wait for the processing class to be removed from body (content loaded)
          await page.waitForFunction(() => {
            return !document.body.classList.contains('processing');
          }, { timeout: 10000 });
          
          console.log(`Page ${pageCount + 1} content loaded, enqueueing doctor profiles...`);
          
          // Enqueue only doctor profile links from the updated content
          await enqueueLinks({
            selector: '.list-doctor .list-doctor__view a.btn-fph',
            label: 'DETAIL',
          });
          
          pageCount++;
        } else {
          console.log('No next button found, pagination complete');
          hasNextPage = false;
        }
      }
      
      console.log(`Pagination completed. Processed ${pageCount} pages.`);
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