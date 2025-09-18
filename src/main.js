import { Actor, log } from 'apify';
import { Dataset } from 'crawlee';

// Main execution function
async function main() {
  // Initialize the Actor first
  await Actor.init();
  
  try {
    log.info('Actor initialized successfully');

    // Get input from Apify
    log.info('Getting input from Apify...');
    const input = await Actor.getInput();
    log.info('Input type:', typeof input);
    log.info('Input length:', input?.length);
    log.info('Input preview:', input?.substring ? input.substring(0, 200) + '...' : input);
    
    // Parse input if it's a string
    let parsedInput;
    try {
      parsedInput = typeof input === 'string' ? JSON.parse(input) : input;
      log.info('Successfully parsed input');
    } catch (parseError) {
      log.error('Failed to parse input as JSON:', parseError);
      throw new Error(`Invalid JSON input: ${parseError.message}`);
    }
    
    log.info('Parsed input keys:', Object.keys(parsedInput));
    log.info('Parsed input values:', parsedInput);
    
    const { resourceIds, startDate, endDate } = parsedInput;

    // Validate input
    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      log.error('Invalid resourceIds:', resourceIds);
      throw new Error('resourceIds must be a non-empty array');
    }

    if (!startDate || !endDate) {
      log.error('Missing dates - startDate:', startDate, 'endDate:', endDate);
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

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Please use YYYY-MM-DD format');
    }

    if (start > end) {
      throw new Error('startDate must be before or equal to endDate');
    }

    log.info(`Processing ${resourceIds.length} resource(s) from ${startDate} to ${endDate}`);

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
      
      for (const resourceId of resourceIds) {
        log.info(`Processing resource: ${resourceId}`);
        
        for (const dateStr of dates) {
          const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%7D`;
          
          try {
            log.info(`Fetching data for resource ${resourceId} on ${dateStr}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check if there are records in the response
            const records = data.result?.records || [];
            log.info(`Found ${records.length} records for resource ${resourceId} on ${dateStr}`);
            
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
            log.info(`Successfully stored data for resource ${resourceId} on ${dateStr} (${records.length} records)`);
            
          } catch (error) {
            log.error(`Error fetching data for resource ${resourceId} on ${dateStr}:`, error);
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