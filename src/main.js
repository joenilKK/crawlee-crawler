import { Actor, log } from 'apify';
import { Dataset } from 'crawlee';

// Main execution function
async function main() {
  // Initialize the Actor first
  await Actor.init();
  
  try {
    log.info('Actor initialized successfully');

    // Predefined array of key-value pairs
    const resourceMap = {
      "a": "d_8575e84912df3c28995b8e6e0e05205a",
      "b": "d_3a3807c023c61ddfba947dc069eb53f2"
    };

    // Define date range yyyy-mm-dd
    const startDate = "2025-08-01";
    const endDate = "2025-08-03";

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error('Dates must be in YYYY-MM-DD format');
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Please use YYYY-MM-DD format');
    }

    if (start > end) {
      throw new Error('startDate must be before or equal to endDate');
    }

    const resourceIds = Object.values(resourceMap);
    log.info(`Processing ${resourceIds.length} resource(s) from ${startDate} to ${endDate}`);
    log.info('Resource mapping:', resourceMap);

    // Generate date range
    const generateDateRange = (startDate, endDate) => {
      const dates = [];
      const current = new Date(startDate);
      const end = new Date(endDate);
      
      log.info(`Date range generation - Start: ${current.toISOString()}, End: ${end.toISOString()}`);
      
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      
      log.info(`Generated dates: ${dates.slice(0, 5).join(', ')}${dates.length > 5 ? '...' : ''}`);
      return dates;
    };

    const dates = generateDateRange(start, end);
    log.info(`Generated ${dates.length} dates to process`);

    const fetchAllData = async () => {
      const dataset = await Dataset.open();
      let totalRecords = 0;
      
      // Loop through each key-value pair in the resource map
      for (const [key, resourceId] of Object.entries(resourceMap)) {
        log.info(`Processing resource key '${key}' with ID: ${resourceId}`);
        
        for (const dateStr of dates) {
          const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%7D`;
          
          try {
            log.info(`Fetching data for resource key '${key}' (${resourceId}) on ${dateStr}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check if there are records in the response
            const records = data.result?.records || [];
            log.info(`Found ${records.length} records for resource key '${key}' on ${dateStr}`);
            
            // Store data in Apify dataset
            const record = {
              resourceKey: key,
              resourceId,
              date: dateStr,
              data,
              recordCount: records.length,
              timestamp: new Date().toISOString()
            };
            
            await dataset.pushData(record);
            totalRecords += records.length;
            log.info(`Successfully stored data for resource key '${key}' on ${dateStr} (${records.length} records)`);
            
          } catch (error) {
            log.error(`Error fetching data for resource key '${key}' on ${dateStr}:`, error);
            // Continue with next iteration instead of stopping
          }
        }
      }
      
      log.info(`Total records processed: ${totalRecords}`);
    };

    // Run the main function
    await fetchAllData();
    log.info('Data fetching completed successfully');
    
  } catch (error) {
    log.error('Fatal error in main execution:', error);
    throw error;
  } finally {
    log.info('Exiting Actor...');
    await Actor.exit();
  }
}

// Execute the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});