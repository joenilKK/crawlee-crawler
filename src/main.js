import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logger
const log = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args)
};

// Main execution function
async function main() {
  try {
    log.info('Starting local execution');

    // Get input from local file or use default
    let input;
    const inputPath = path.join(__dirname, '..', 'input.json');
    
    if (fs.existsSync(inputPath)) {
      const inputData = fs.readFileSync(inputPath, 'utf8');
      input = JSON.parse(inputData);
      log.info('Loaded input from input.json');
    } else {
      // Default input for local testing
      input = {
        resourceIds: [
          'd_8575e84912df3c28995b8e6e0e05205a',
          'd_3a3807c023c61ddfba947dc069eb53f2',
          'd_c0650f23e94c42e7a20921f4c5b75c24',
          'd_acbc938ec77af18f94cecc4a7c9ec720',
          'd_124a9bd407c7a25f8335b93b86e50fdd',
          'd_4526d47d6714d3b052eed4a30b8b1ed6',
          'd_b58303c68e9cf0d2ae93b73ffdbfbfa1',
          'd_fa2ed456cf2b8597bb7e064b08fc3c7c',
          'd_85518d970b8178975850457f60f1e738',
          'd_478f45a9c541cbe679ca55d1cd2b970b',
          'd_5573b0db0575db32190a2ad27919a7aa',
          'd_a2141adf93ec2a3c2ec2837b78d6d46e',
          'd_9af9317c646a1c881bb5591c91817cc6',
          'd_67e99e6eabc4aad9b5d48663b579746a',
          'd_5c4ef48b025fdfbc80056401f06e3df9',
          'd_300ddc8da4e8f7bdc1bfc62d0d99e2e7',
          'd_181005ca270b45408b4cdfc954980ca2',
          'd_4130f1d9d365d9f1633536e959f62bb7',
          'd_2b8c54b2a490d2fa36b925289e5d9572',
          'd_df7d2d661c0c11a7c367c9ee4bf896c1',
          'd_72f37e5c5d192951ddc5513c2b134482',
          'd_0cc5f52a1f298b916f317800251057f3',
          'd_e97e8e7fc55b85a38babf66b0fa46b73',
          'd_af2042c77ffaf0db5d75561ce9ef5688',
          'd_1cd970d8351b42be4a308d628a6dd9d3',
          'd_31af23fdb79119ed185c256f03cb5773',
          'd_4e3db8955fdcda6f9944097bef3d2724'
        ], // Replace with actual resource IDs
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };
      log.info('Using default input (create input.json to customize)');
    }
    
    // Extract resourceIds, startDate and endDate from input
    const resourceIds = input.resourceIds;
    const startDate = input.startDate;
    const endDate = input.endDate;
    const ssic = 86201;

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

    log.info('='.repeat(60));
    log.info(`Configuration Summary:`);
    log.info(`  - Total Resources: ${resourceIds.length}`);
    log.info(`  - Date Range: ${startDate} to ${endDate}`);
    log.info(`  - SSIC Code: ${ssic}`);
    log.info(`  - Resource IDs: ${resourceIds.length} resource(s)`);
    log.info('='.repeat(60));

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
    const totalRequests = resourceIds.length * dates.length * 2; // 2 SSIC types
    log.info(`Generated ${dates.length} dates to process`);
    log.info(`Total API requests to make: ${totalRequests}`);
    log.info('='.repeat(60));

    const fetchAllData = async () => {
      const outputPath = path.join(__dirname, '..', 'output.json');
      const allRecords = [];
      let totalRecords = 0;
      let duplicateRecords = 0;
      let errorCount = 0;
      let requestCount = 0;
      const processedUENs = new Set(); // Track processed UENs to prevent duplicates
      
      // Helper function to add delay between requests
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Retry function for fetch requests
      const fetchWithRetry = async (url, options = {}, maxRetries = 3, retryDelay = 2000) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(url, {
              ...options,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...options.headers
              }
            });
            
            // Handle 429 (Rate Limit) errors with retry
            if (response.status === 429) {
              if (attempt === maxRetries) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              // Exponential backoff for rate limiting (longer delays)
              const delayMs = retryDelay * Math.pow(2, attempt - 1);
              log.info(`    → Rate limited (429) - attempt ${attempt}/${maxRetries}, waiting ${delayMs}ms before retry...`);
              await delay(delayMs);
              continue; // Retry the request
            }
            
            // If successful, return response immediately
            return response;
          } catch (error) {
            lastError = error;
            
            // Don't retry on 404 errors
            if (error.message?.includes('404')) {
              throw error;
            }
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
              throw error;
            }
            
            // Calculate exponential backoff delay
            const delayMs = retryDelay * Math.pow(2, attempt - 1);
            log.info(`    → Fetch failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
            await delay(delayMs);
          }
        }
        
        // Should never reach here, but just in case
        throw lastError;
      };
      
      // Define SSIC codes to process
      const ssicCodes = [
        { type: 'primary_ssic_code', value: ssic },
        { type: 'secondary_ssic_code', value: ssic }
      ];
      
      // Loop through each SSIC code type
      for (let ssicIdx = 0; ssicIdx < ssicCodes.length; ssicIdx++) {
        const ssicConfig = ssicCodes[ssicIdx];
        log.info('');
        log.info('─'.repeat(60));
        log.info(`[SSIC ${ssicIdx + 1}/${ssicCodes.length}] Processing ${ssicConfig.type} with value ${ssicConfig.value}`);
        log.info('─'.repeat(60));
        
        // Loop through each resource ID
        for (let i = 0; i < resourceIds.length; i++) {
          const resourceId = resourceIds[i];
          log.info('');
          log.info(`[Resource ${i + 1}/${resourceIds.length}] Resource ID: ${resourceId}`);
          log.info(`  SSIC Type: ${ssicConfig.type} | SSIC Value: ${ssicConfig.value}`);
          
          let resourceRecords = 0;
          
          for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
            const dateStr = dates[dateIdx];
            requestCount++;
            const progress = ((requestCount / totalRequests) * 100).toFixed(1);
            
            log.info(`  [Date ${dateIdx + 1}/${dates.length}] ${dateStr} | Progress: ${progress}% (${requestCount}/${totalRequests})`);
            
            // Add delay before request to avoid rate limiting
            await delay(1500);
            
            const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&fields=uen%2Cuen_issue_date%2C+registration_incorporation_date%2C+entity_name%2Caddress_type%2Cbuilding_name%2Cstreet_name%2Cprimary_ssic_code%2Csecondary_ssic_code%2Cblock%2Clevel_no%2Cunit_no%2Cpostal_code%2Centity_type_description%2Cbusiness_constitution_description%2Ccompany_type_description%2Centity_status_description&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%2C%22${ssicConfig.type}%22%3A%22${ssicConfig.value}%22%7D`;
            
            try {
              const response = await fetchWithRetry(url, {}, 3, 2000);
              
              if (response.status === 404) {
                // Skip 404 errors silently (invalid resource ID or no data)
                log.info(`    → No data found (404) - skipping`);
                continue;
              }
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              const data = await response.json();
              
              // Check if API returned an error
              if (data.error) {
                log.error(`    → API error: ${data.error.message || JSON.stringify(data.error)}`);
                errorCount++;
                continue;
              }
              
              // Check if there are records in the response
              const records = data.result?.records || [];
              
              if (records.length > 0) {
                log.info(`    → Found ${records.length} record(s)`);
              } else {
                log.info(`    → No records found`);
              }
              
              // Process each record with deduplication
              let newRecords = 0;
              for (const record of records) {
                const uen = record.uen;
                
                // Check if this UEN has already been processed
                if (processedUENs.has(uen)) {
                  duplicateRecords++;
                  log.debug(`    → Skipping duplicate UEN: ${uen} (${record.entity_name})`);
                  continue;
                }
                
                // Add UEN to processed set and save record with SSIC source info
                processedUENs.add(uen);
                const recordWithSource = {
                  ...record,
                  ssic_source: ssicConfig.type
                };
                allRecords.push(recordWithSource);
                totalRecords++;
                newRecords++;
                resourceRecords++;
              }
              
              if (newRecords > 0) {
                log.info(`    → Added ${newRecords} new record(s) | Total so far: ${totalRecords}`);
              }
              
            } catch (error) {
              // Only log non-404 errors
              if (!error.message?.includes('404')) {
                log.error(`    → Error: ${error.message}`);
                errorCount++;
              }
              // Add delay after error to avoid rate limiting
              await delay(2000);
            }
          }
          
          if (resourceRecords > 0) {
            log.info(`  ✓ Resource ${i + 1} completed: ${resourceRecords} record(s) found`);
          } else {
            log.info(`  ✓ Resource ${i + 1} completed: No records found`);
          }
        }
      }
      
      log.info('');
      log.info('='.repeat(60));
      log.info('Final Summary:');
      log.info('='.repeat(60));
      log.info(`  Total unique records processed: ${totalRecords}`);
      log.info(`  Total duplicate records skipped: ${duplicateRecords}`);
      log.info(`  Total errors encountered: ${errorCount}`);
      log.info(`  Total requests made: ${requestCount}/${totalRequests}`);
      log.info(`  Output file: ${outputPath}`);
      log.info('='.repeat(60));
      
      // Save all records to output file
      fs.writeFileSync(outputPath, JSON.stringify(allRecords, null, 2), 'utf8');
      log.info(`Results saved successfully to ${outputPath}`);
    };

    // Run the main function
    await fetchAllData();
    log.info('Data fetching completed successfully');
    
  } catch (error) {
    log.error('Fatal error in main execution:', error);
    throw error;
  } finally {
    log.info('Execution completed');
  }
}

// Execute the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});