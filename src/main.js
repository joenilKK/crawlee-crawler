import { Actor } from 'apify';
import { Dataset } from 'crawlee';

// Initialize the Actor
await Actor.init();

// Get input from Apify
const input = await Actor.getInput();
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

const fetchAllData = async () => {
  const dataset = await Dataset.open();
  
  for (const resourceId of resourceIds) {
    for (const dateStr of dates) {
      const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&filters=%7B%22uen_issue_date%22%3A%22${dateStr}%22%7D`;
      
      try {
        Actor.log.info(`Fetching data for resource ${resourceId} on ${dateStr}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Store data in Apify dataset
        const record = {
          resourceId,
          date: dateStr,
          data,
          timestamp: new Date().toISOString()
        };
        
        await dataset.pushData(record);
        Actor.log.info(`Successfully stored data for resource ${resourceId} on ${dateStr}`);
        
      } catch (error) {
        Actor.log.error(`Error fetching data for resource ${resourceId} on ${dateStr}:`, error);
        // Continue with next iteration instead of stopping
      }
    }
  }
};

// Run the main function
try {
  await fetchAllData();
  Actor.log.info('Data fetching completed successfully');
} catch (error) {
  Actor.log.error('Fatal error:', error);
  throw error;
} finally {
  await Actor.exit();
}