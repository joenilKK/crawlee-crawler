import { Actor, log } from 'apify';
import { Dataset } from 'crawlee';

// Main execution function
async function main() {
  // Initialize the Actor first
  await Actor.init();
  
  try {
    log.info('Actor initialized successfully');

    // Get input from Actor
    const input = await Actor.getInput();
    
    // Extract resourceIds, startDate and endDate from input
    const resourceIds = input.resourceIds;
    const startDate = input.startDate;
    const endDate = input.endDate;

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

    log.info(`Processing ${resourceIds.length} resource(s) from ${startDate} to ${endDate}`);
    log.info('Resource IDs:', resourceIds);

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
      
      // Loop through each resource ID
      for (const resourceId of resourceIds) {
        log.info(`Processing resource ID: ${resourceId}`);
        
        for (const dateStr of dates) {
          const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%7D`;
          
          try {
            log.info(`Fetching data for resource ID '${resourceId}' on ${dateStr}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check if there are records in the response
            const records = data.result?.records || [];
            log.info(`Found ${records.length} records for resource ID '${resourceId}' on ${dateStr}`);
            
            // Store each record individually in Apify dataset
            for (const record of records) {
              await dataset.pushData(record);
              totalRecords++;
            }
            
            log.info(`Successfully stored ${records.length} individual records for resource ID '${resourceId}' on ${dateStr}`);
            
          } catch (error) {
            log.error(`Error fetching data for resource ID '${resourceId}' on ${dateStr}:`, error);
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