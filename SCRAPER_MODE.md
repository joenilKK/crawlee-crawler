# Scraper-Only Mode

This crawler now supports a **scraper-only mode** that allows you to scrape data from specific websites without crawling multiple pages or following pagination. This is perfect for extracting data from a list of specific URLs.

## How to Use Scraper Mode

### 1. Enable Scraper Mode

In your `local-config.js` file, set:

```javascript
scraperMode: true,
```

### 2. Configure URLs to Scrape

Add the URLs you want to scrape to the `scraperUrls` array:

```javascript
scraperUrls: [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://another-site.com/data'
],
```

### 3. Configure Custom Selectors

Define CSS selectors for the data you want to extract:

```javascript
customSelectors: {
    title: 'h1, .title, .heading',
    description: 'p, .description, .content',
    images: 'img[src]',
    links: 'a[href]',
    email: 'a[href^="mailto:"]',
    phone: 'a[href^="tel:"]',
    // Add more selectors as needed
}
```

## Example Configuration

Here's a complete example configuration for scraper mode:

```javascript
export const LOCAL_CONFIG = {
    // Enable scraper-only mode
    scraperMode: true,
    // Basic crawler settings
    
    // URLs to scrape
    scraperUrls: [
        'https://example.com',
        'https://httpbin.org/html',
    ],
    
    // Data extraction selectors
    customSelectors: {
        title: 'h1, .title, .heading',
        description: 'p, .description, .summary',
        links: 'a[href]',
        images: 'img[src]',
        content: '.content, main, article',
    },
    
    // Basic settings (required)
    siteName: 'My Scraper',
    baseUrl: 'https://example.com',
    startUrl: 'https://example.com', // Not used in scraper mode
    allowedUrlPatterns: ['*'], // Not used in scraper mode
    
    // Scraper settings
    headless: false, // Set to true for headless mode
    timeout: 30000,
    maxRequestsPerCrawl: 50,
    outputFilename: 'scraped-data',
    
    // Required selectors (not used in scraper mode, but required)
    paginationType: 'query',
    specialistLinksSelector: 'a',
    nextButtonSelector: '.next',
    nextButtonContainerSelector: '.pagination',
    doctorNameSelector: 'h1',
    contactLinksSelector: 'a',
};
```

## Selector Features

### Multiple Fallback Selectors
You can provide multiple selectors separated by commas. The scraper will try each selector until it finds data:

```javascript
title: 'h1, .page-title, .main-heading, .title'
```

### Automatic Data Type Detection
The scraper automatically detects data types based on field names:

- **Images**: Fields containing "image" or "img" will extract image data (src, alt, title)
- **Links**: Fields containing "link" or "url" will extract link data (text, href, title)
- **Text**: All other fields extract text content

### Advanced Selectors
You can use any CSS selector:

```javascript
customSelectors: {
    // Get all paragraphs in the main content
    content: 'main p, .content p, article p',
    
    // Get email addresses
    emails: 'a[href^="mailto:"]',
    
    // Get phone numbers
    phones: 'a[href^="tel:"]',
    
    // Get social media links
    social: 'a[href*="facebook.com"], a[href*="twitter.com"]',
    
    // Get specific attributes
    imageAlts: 'img[alt]', // Will extract alt attributes
}
```

## Output Format

The scraper will create a JSON file with the following structure:

```json
[
    {
        "url": "https://example.com",
        "title": "Example Page",
        "extractedAt": "2025-01-11T10:30:00.000Z",
        "data": {
            "title": "Welcome to Example",
            "description": "This is an example page",
            "links": [
                {
                    "text": "About Us",
                    "href": "https://example.com/about",
                    "title": ""
                }
            ],
            "images": [
                {
                    "src": "https://example.com/logo.png",
                    "alt": "Company Logo",
                    "title": ""
                }
            ]
        },
        "meta": {
            "description": "Page meta description",
            "keywords": "example, test, demo"
        }
    }
]
```

## Running the Scraper

Once configured, run the scraper with:

```bash
npm start
```

or

```bash
node src/main.js
```

The scraper will:
1. Check that scraper mode is enabled
2. Validate that URLs are provided
3. Visit each URL in sequence
4. Extract data using your custom selectors
5. Save results to a JSON file

## Tips

1. **Start with a few URLs** to test your selectors before scraping many pages
2. **Use `headless: false`** during development to see what's happening
3. **Test your CSS selectors** in browser dev tools first
4. **Use multiple fallback selectors** for better data extraction success
5. **Check the output file** to refine your selectors

## Error Handling

If a URL fails to load or a selector doesn't find data:
- The scraper will continue with other URLs
- Failed URLs will be logged with error messages
- Missing data fields will be set to `null` in the output
- The scraper won't stop on individual failures

This makes the scraper robust for batch processing of multiple URLs.
