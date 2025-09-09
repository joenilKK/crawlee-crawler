# Mount Elizabeth Crawler - Modular Structure

## 📁 Folder Organization

```
src/
├── main.js                    # Main crawler entry point
├── config/
│   └── config.js             # Configuration and settings
├── handlers/
│   ├── dataExtractor.js      # Data extraction logic
│   ├── fileHandler.js        # File I/O operations
│   └── paginationHandler.js  # Pagination logic
└── utils/
    └── helpers.js            # Utility functions
```

## 🚀 Usage

Run the crawler from the project root:
```bash
node src/main.js
```

## 📝 Module Descriptions

### **config/config.js**
- Site URLs and configuration
- URL filtering patterns (allowed/excluded)
- CSS selectors for scraping
- Crawler settings (headless, timeout, etc.)
- Output file naming

### **handlers/dataExtractor.js**
- Extract doctor names and contact details
- Handle extraction errors gracefully
- Format extracted data consistently

### **handlers/fileHandler.js**
- Save data to JSON files with metadata
- Create backups of existing files
- Handle file system operations

### **handlers/paginationHandler.js**
- Check for next page availability
- Generate next page URLs
- Handle both initial and subsequent pagination

### **utils/helpers.js**
- Date formatting utilities
- URL validation
- Filename sanitization
- General helper functions

## 🔧 Configuration

To crawl a different site, update `config/config.js`:

```javascript
SITE: {
    name: 'New Hospital',
    baseUrl: 'https://newhospital.com/',
    startUrl: 'https://newhospital.com/doctors/',
    allowedUrlPatterns: [
        'https://newhospital.com/doctors/',
        'https://newhospital.com/doctors/*'
    ],
    excludedUrlPatterns: [
        'https://newhospital.com/admin/*',
        'https://newhospital.com/services/*'
    ]
},
SELECTORS: {
    specialistLinks: '.doctor-list a',
    doctorName: '.doctor-name h1'
    // ... other selectors
}
```

### **URL Filtering**
- **allowedUrlPatterns**: Only URLs matching these patterns will be crawled
- **excludedUrlPatterns**: URLs matching these patterns will be skipped
- Supports wildcards (`*`) for flexible pattern matching
- Excluded patterns take precedence over allowed patterns

## 📊 Output

Data is saved as: `mountelizabeth-specialists-YYYY-MM-DD.json`

Contains:
- Site metadata
- Extraction timestamp
- Total record count
- Array of specialist data
