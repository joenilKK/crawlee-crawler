# Mount Elizabeth Medical Centre Crawler

An Apify Actor that crawls specialist information from Mount Elizabeth Medical Centre website with configurable pagination and selectors.

## Features

- 🏥 Crawls specialist profiles from Mount Elizabeth Medical Centre
- 🔄 Flexible pagination support (query parameters or path-based)
- ⚙️ Fully configurable selectors and URL patterns
- 📊 Extracts doctor names and contact details
- 💾 Saves data in JSON format and Apify dataset
- 🐳 Docker containerized for Apify platform
- 🎛️ Web UI for easy configuration

## Configuration

The actor accepts the following input parameters through the Apify platform:

### Site Settings
- **Site Name**: Name of the medical center
- **Base URL**: Base URL of the website
- **Start URL**: URL to start crawling from
- **Allowed URL Patterns**: URL patterns that are allowed to be crawled
- **Excluded URL Patterns**: URL patterns to exclude from crawling

### Pagination Settings
- **Pagination Type**: Choose between query parameters (`?page=2`) or path-based (`/page/2/`)
- **Query Pattern**: Pattern for query-based pagination (use `{page}` as placeholder)
- **Path Pattern**: Pattern for path-based pagination (use `{page}` as placeholder)
- **Pagination Base URL**: Base URL for pagination (optional)
- **Start Page Number**: Page number to start pagination from

### Selectors
- **Specialist Links Selector**: CSS selector for specialist profile links
- **Next Button Selector**: CSS selector for the next page button
- **Next Button Container Selector**: CSS selector for the next button container
- **Doctor Name Selector**: CSS selector for doctor name on detail pages
- **Contact Links Selector**: CSS selector for contact links on detail pages

### Crawler Settings
- **Max Requests Per Crawl**: Maximum number of requests to process
- **Headless Mode**: Run browser in headless mode
- **Timeout**: Timeout for page operations in milliseconds
- **Output Filename**: Custom filename for the output (optional)

## Running Locally

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Development
To run locally with default configuration:
```bash
npm start
```

To run with Apify Actor environment:
```bash
# Set input as environment variable
export APIFY_INPUT_JSON='{"siteName": "Mount Elizabeth Medical Centre", "startUrl": "https://www.mountelizabeth.com.sg/patient-services/specialists/"}'
npm start
```

## Deployment to Apify

### Using Apify CLI
1. Install Apify CLI: `npm install -g apify-cli`
2. Login to Apify: `apify login`
3. Deploy: `apify push`

### Using Apify Console
1. Create a new Actor in [Apify Console](https://console.apify.com)
2. Upload your code or connect to a Git repository
3. Configure the build and run settings
4. Test with the input schema

## Output

The actor produces:
1. **JSON file**: Saved locally with extracted data
2. **Apify Dataset**: Structured data accessible via Apify API

### Output Format
```json
{
  "summary": {
    "totalRecords": 150,
    "siteName": "Mount Elizabeth Medical Centre",
    "startUrl": "https://www.mountelizabeth.com.sg/patient-services/specialists/",
    "extractedAt": "2024-01-15T10:30:00.000Z",
    "outputFile": "memc-specialists-2024-01-15.json"
  },
  "specialists": [
    {
      "url": "https://www.mountelizabeth.com.sg/patient-services/specialists/doctor-name",
      "doctorName": "Dr. John Smith",
      "contactDetails": [
        {
          "text": "Mount Elizabeth Hospital",
          "link": "tel:+6567377888"
        }
      ],
      "extractedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## File Structure

```
├── .actor/
│   └── actor.json          # Apify Actor configuration
├── src/
│   ├── config/
│   │   └── config.js       # Static configuration (legacy)
│   ├── handlers/
│   │   ├── dataExtractor.js    # Data extraction logic
│   │   ├── fileHandler.js      # File operations
│   │   └── paginationHandler.js # Pagination logic
│   ├── utils/
│   │   └── helpers.js      # Utility functions
│   └── main.js             # Main crawler entry point
├── INPUT_SCHEMA.json       # Apify input schema
├── Dockerfile              # Docker configuration
└── package.json            # Dependencies and scripts
```

## Customization

### Adding New Selectors
Update the `INPUT_SCHEMA.json` to add new selector fields and modify the extraction logic in `src/handlers/dataExtractor.js`.

### Supporting Different Pagination Types
Extend the pagination logic in `src/handlers/paginationHandler.js` to support additional pagination patterns.

### Custom Data Extraction
Modify `src/handlers/dataExtractor.js` to extract additional fields from specialist pages.

## Troubleshooting

### Common Issues
1. **Selectors not found**: Check if the website structure has changed
2. **Pagination not working**: Verify pagination configuration matches the website
3. **Timeout errors**: Increase the timeout value in configuration
4. **Memory issues**: Reduce `maxRequestsPerCrawl` for large websites

### Debugging
- Set `headless: false` to see the browser in action
- Check the logs for detailed error messages
- Use browser dev tools to verify selectors

## License

ISC

## Support

For issues and questions:
1. Check the [Crawlee documentation](https://crawlee.dev/)
2. Review [Apify Actor documentation](https://docs.apify.com/actors)
3. Create an issue in this repository