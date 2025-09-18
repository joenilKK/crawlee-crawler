import { Actor } from 'apify';
import { Dataset } from 'crawlee';

// Main execution function
const main = async () => {
  try {
    // Initialize the Actor
    Actor.log.info('Initializing Actor...');
    await Actor.init();

    // Get input from Apify
    Actor.log.info('Getting input from Apify...');
    const input = await Actor.getInput();
    Actor.log.info('Input received:', JSON.stringify(input, null, 2));
    
    const { resourceIds, startDate, endDate } = input;

    // Validate input
    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      throw new Error('resourceIds must be a non-empty array');
    }

    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error('Dates must be in YYYY-MM-DD format');
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new Error('startDate must be before or equal to endDate');
    }

    Actor.log.info(`Processing ${resourceIds.length} resource(s) from ${startDate} to ${endDate}`);

    // Generate date range
    const generateDateRange = (startDate, endDate) => {
      const dates = [];
      const current = new Date(startDate);
      const end = new Date(endDate);
      
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      
      return dates;
    };

    const dates = generateDateRange(start, end);
    Actor.log.info(`Generated ${dates.length} dates to process`);

    const fetchAllData = async () => {
      const dataset = await Dataset.open();
      let totalRecords = 0;
      
      for (const resourceId of resourceIds) {
        Actor.log.info(`Processing resource: ${resourceId}`);
        
        for (const dateStr of dates) {
          const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%7D`;
          
          try {
            Actor.log.info(`Fetching data for resource ${resourceId} on ${dateStr}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check if there are records in the response
            const records = data.result?.records || [];
            Actor.log.info(`Found ${records.length} records for resource ${resourceId} on ${dateStr}`);
            
            // Store data in Apify dataset
            const record = {
              resourceId,
              date: dateStr,
              data,
              recordCount: records.length,
              timestamp: new Date().toISOString()
            };
            
            await dataset.pushData(record);
            totalRecords += records.length;
            Actor.log.info(`Successfully stored data for resource ${resourceId} on ${dateStr} (${records.length} records)`);
            
          } catch (error) {
            Actor.log.error(`Error fetching data for resource ${resourceId} on ${dateStr}:`, error);
            // Continue with next iteration instead of stopping
          }
        }
      }
      
      Actor.log.info(`Total records processed: ${totalRecords}`);
    };

    // Run the main function
    await fetchAllData();
    Actor.log.info('Data fetching completed successfully');
    
  } catch (error) {
    console.error('Fatal error in main execution:', error);
    throw error;
  } finally {
    try {
      console.log('Exiting Actor...');
      await Actor.exit();
    } catch (exitError) {
      console.error('Error during Actor exit:', exitError);
    }
  }
};

// Execute the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});