# Universal Web Crawler

A flexible web crawler that works both locally and as an Apify Actor. Designed for crawling specialist information from medical center websites with configurable pagination and selectors.

## Features

- 🏥 **Medical Site Optimization**: Specialized extractors for medical/doctor websites
- 🍪 **Cookie Support**: Import cookies from browser extensions for authenticated scraping
- 🔄 **Flexible Pagination**: Support for both query-based (?page=2) and path-based (/page/2/) pagination
- ⚙️ **Fully Configurable**: Custom selectors, URL patterns, and extraction rules
- 💾 **Multiple Output Formats**: Save data in JSON format and Apify dataset
- 🐳 **Docker Containerized**: Ready for Apify platform deployment
- 🎛️ **Web UI Configuration**: Easy setup through Apify Console
- 💻 **Local Development Support**: Test before deploying to Apify
- 🤖 **Advanced Stealth Mode**: Avoid bot detection with smart delays and headers
- 🔄 **Automatic Retry Mechanism**: Handle failed requests gracefully
- ✨ **Modern Codebase**: No deprecated dependencies, clean architecture

## Configuration

### Apify Actor Input

The actor accepts a single input parameter through the Apify platform:

- **Max Requests Per Crawl**: Maximum number of requests to process (required)

### Local Configuration

All other settings (site configuration, selectors, pagination, etc.) are configured in the `src/config/local-config.js` file:

- **Site Settings**: Site name, base URL, start URL, allowed/excluded URL patterns
- **Pagination Settings**: Pagination type, query/path patterns, base URL, start page
- **Selectors**: CSS selectors for specialist links, buttons, doctor names, contact links
- **Crawler Settings**: Headless mode, timeout, output filename
- **Cookie Support**: Cookies for authenticated scraping
- **User Agent**: Custom user agent string

### 🍪 Cookie Support

The crawler supports importing cookies from browser extensions for authenticated scraping. Configure cookies in `src/config/local-config.js`:

```javascript
cookies: [
  {
    "name": "session_id",
    "value": "abc123xyz",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "lax",
    "expirationDate": 1757322910.775961
  }
]
```

#### Required Cookie Fields:
- `name`: Cookie name
- `value`: Cookie value  
- `domain`: Cookie domain (e.g., '.example.com')

#### Optional Cookie Fields:
- `path`: Cookie path (default: '/')
- `secure`: HTTPS requirement (default: false)
- `httpOnly`: HTTP-only flag (default: false)
- `sameSite`: SameSite policy ('lax', 'strict', 'no_restriction')
- `expirationDate`: Unix timestamp for expiration

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Configuration
The crawler automatically detects whether it's running locally or in Apify environment.

#### For Local Development:
1. Edit `src/config/local-config.js` to configure your target website
2. Adjust selectors, URLs, and crawler settings as needed
3. Set `headless: false` for debugging (see browser actions)
4. Set `maxRequestsPerCrawl` to a lower number for testing, or -1 for unlimited crawling

#### For Apify Deployment:
1. All site configuration is taken from `src/config/local-config.js`
2. Only `maxRequestsPerCrawl` can be configured through the Apify input schema
3. This allows for consistent site configuration while allowing request limits to be adjusted per run

#### Optional: Create Override File
Create `src/config/local-config-override.js` to override specific settings without modifying the main config:

```javascript
export const LOCAL_CONFIG_OVERRIDE = {
    startUrl: 'https://your-custom-site.com/specialists/',
    headless: false,
    maxRequestsPerCrawl: 10, // Use -1 for unlimited crawling
    // ... any other settings you want to override
    // Note: When running through Apify, only maxRequestsPerCrawl can be overridden
};
```

### Running Locally

#### Regular Crawling Mode
```bash
# Run with local configuration
npm run dev

# Alternative commands (all do the same thing locally)
npm run local
npm start
```

The crawler will:
1. Start from the configured start URL
2. Extract specialist profile links
3. Follow pagination to discover all pages
4. Visit each specialist profile and extract data
5. Save results to a JSON file in the project root

### Testing Different Configurations
You can test different sites by modifying the local configuration file or creating override files for different scenarios.

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
│   │   ├── config.js       # Static configuration (legacy)
│   │   ├── environment.js  # Environment detection & config
│   │   ├── local-config.js # Local development configuration
│   │   └── local-config-override.js # Optional overrides (create manually)
│   ├── handlers/
│   │   ├── dataExtractor.js    # Data extraction logic
│   │   ├── fileHandler.js      # File operations
│   │   └── paginationHandler.js # Pagination logic
│   ├── utils/
│   │   ├── helpers.js      # Utility functions
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
4. **Memory issues**: Reduce `maxRequestsPerCrawl` for large websites (or use -1 for unlimited crawling if memory allows)

### Debugging

#### Local Development
- Set `headless: false` in `src/config/local-config.js` to see the browser in action
- Reduce `maxRequestsPerCrawl` to test with fewer pages (or use -1 for unlimited crawling)
- Check console logs for detailed error messages
- Use browser dev tools to verify selectors

#### Apify Environment
- Use the Apify Console logs to debug issues
- Set headless to false temporarily for debugging (if needed)
- Use the dataset preview to check extracted data

### Environment Detection
The crawler automatically detects the environment:
- **Local**: Uses `src/config/local-config.js` for configuration
- **Apify**: Uses Actor input from Apify platform

### Development Workflow
1. **Local Testing**: Configure and test locally with `npm run dev`
2. **Deploy to Apify**: Push to Apify when local testing is successful
3. **Production**: Use Apify Actor input schema for production runs

## License

ISC

## Support

For issues and questions:
1. Check the [Crawlee documentation](https://crawlee.dev/)
2. Review [Apify Actor documentation](https://docs.apify.com/actors)
3. Create an issue in this repository