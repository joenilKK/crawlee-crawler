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
    
    // Extract resourceIds, startDate, endDate and optional requestDelayMs from input
    const resourceIds = input.resourceIds;
    const startDate = input.startDate;
    const endDate = input.endDate;
    const requestDelayMs = input.requestDelayMs ?? 1500; // default 1.5s between requests to avoid 429
    const ssic = 86201;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchWithRetry = async (url, maxRetries = 10) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url);
          
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter 
              ? parseInt(retryAfter) * 1000 
              : requestDelayMs * Math.pow(2, attempt); // exponential backoff
            
            if (attempt < maxRetries) {
              log.warning(`Rate limited (429) on attempt ${attempt + 1}/${maxRetries + 1}. Waiting ${waitTime}ms before retry...`);
              await sleep(waitTime);
              continue;
            } else {
              throw new Error(`HTTP 429 after ${maxRetries + 1} attempts`);
            }
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          return await response.json();
        } catch (error) {
          if (attempt === maxRetries) {
            throw error;
          }
          // For other errors, wait before retry
          const waitTime = requestDelayMs * Math.pow(2, attempt);
          log.warning(`Request failed on attempt ${attempt + 1}/${maxRetries + 1}: ${error.message}. Waiting ${waitTime}ms before retry...`);
          await sleep(waitTime);
        }
      }
    };

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
      let duplicateRecords = 0;
      const processedUENs = new Set(); // Track processed UENs to prevent duplicates
      
      // Define SSIC codes to process
      const ssicCodes = [
        { type: 'primary_ssic_code', value: ssic },
        { type: 'secondary_ssic_code', value: ssic }
      ];
      
      // Loop through each SSIC code type
      for (const ssicConfig of ssicCodes) {
        log.info(`Processing ${ssicConfig.type} with value ${ssicConfig.value}`);
        
        // Loop through each resource ID
        for (let i = 0; i < resourceIds.length; i++) {
          const resourceId = resourceIds[i];
          log.info(`Processing resource ${i + 1}/${resourceIds.length}: ${resourceId} for ${ssicConfig.type}`);
          
          for (const dateStr of dates) {
            const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&fields=uen%2Cuen_issue_date%2C+registration_incorporation_date%2C+entity_name%2Caddress_type%2Cbuilding_name%2Cstreet_name%2Cprimary_ssic_code%2Csecondary_ssic_code%2Cblock%2Clevel_no%2Cunit_no%2Cpostal_code%2Centity_type_description%2Cbusiness_constitution_description%2Ccompany_type_description%2Centity_status_description&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%2C%22${ssicConfig.type}%22%3A%22${ssicConfig.value}%22%7D`;
            
            try {
              // Add delay before each request to avoid hitting rate limits
              await sleep(requestDelayMs);
              
              log.info(`Fetching data for resource ${i + 1} (${resourceId}) on ${dateStr} with ${ssicConfig.type}`);
              
              const data = await fetchWithRetry(url);
              
              // Check if there are records in the response
              const records = data.result?.records || [];
              log.info(`Found ${records.length} records for resource ${i + 1} on ${dateStr} with ${ssicConfig.type}`);
              
              // Process each record with deduplication
              for (const record of records) {
                const uen = record.uen;
                
                // Check if this UEN has already been processed
                if (processedUENs.has(uen)) {
                  duplicateRecords++;
                  log.debug(`Skipping duplicate record for UEN: ${uen} (${record.entity_name})`);
                  continue;
                }
                
                // Add UEN to processed set and save record with SSIC source info
                processedUENs.add(uen);
                const recordWithSource = {
                  ...record,
                  ssic_source: ssicConfig.type
                };
                await dataset.pushData(recordWithSource);
                totalRecords++;
              }
              
              log.info(`Successfully stored ${records.length} records for resource ${i + 1} on ${dateStr} with ${ssicConfig.type} (${duplicateRecords} duplicates skipped)`);
              
            } catch (error) {
              log.error(`Error fetching data for resource ${i + 1} on ${dateStr} with ${ssicConfig.type}: ${error.message || error}`);
              // Additional delay after error before continuing to next request
              await sleep(requestDelayMs * 2);
            }
          }
        }
      }
      
      log.info(`Total unique records processed: ${totalRecords}`);
      log.info(`Total duplicate records skipped: ${duplicateRecords}`);
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