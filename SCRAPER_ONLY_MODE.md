# Scraper-Only Mode Guide

The scraper-only mode allows you to scrape specific URLs without crawling or pagination. This is perfect when you have a list of specific pages you want to extract data from.

## How It Works

Instead of starting from a listing page and discovering links, scraper-only mode:

1. Takes a predefined list of URLs
2. Visits each URL directly
3. Extracts data using custom selectors
4. Automatically detects medical/doctor sites for specialized extraction
5. Saves all results to a single output file

## Configuration

### Apify Platform

When using the Apify actor, configure these settings:

1. **Enable Scraper-Only Mode**: Check the "Scraper-Only Mode" checkbox
2. **URLs to Scrape**: Add your list of URLs to scrape
3. **Custom Selectors**: Define CSS selectors for the data you want to extract

Example custom selectors:
```json
{
  "doctorName": ".doctor-name, h1, h2",
  "position": ".specialty, .position",
  "phoneLinks": "a[href^='tel:']",
  "emailLinks": "a[href^='mailto:']",
  "education": ".education, .qualifications",
  "clinicAddress": ".address, .location"
}
```

### Local Development

1. Copy `src/config/scraper-only-example.js` to `src/config/local-config.js`
2. Modify the configuration:
   - Set `scraperMode: true`
   - Add your URLs to the `scraperUrls` array
   - Customize the `customSelectors` object
3. Run with `npm start`

## Medical Site Detection

The scraper automatically detects medical/doctor websites based on:
- Page title containing: "doctor", "hospital", "medical", "clinic"
- URL containing: "doctor", "medical", "hospital"

When detected, it uses specialized extractors that:
- Look for doctor cards/containers
- Extract names, positions, and phone numbers
- Handle different page layouts automatically
- Use fallback extraction methods if needed

## Custom Selectors

You can define any CSS selectors you need:

### Common Selectors
- `doctorName`: Doctor's name
- `position`: Job title or specialty
- `phoneLinks`: Phone number links
- `emailLinks`: Email links
- `education`: Educational background
- `experience`: Work experience
- `specialties`: Medical specialties
- `languages`: Spoken languages

### Advanced Selectors
- `doctorCards`: Container elements for each doctor
- `doctorImage`: Doctor's photo
- `clinicName`: Clinic or hospital name
- `clinicAddress`: Clinic address

### Selector Tips

1. **Use multiple selectors**: Separate with commas for fallbacks
   ```javascript
   doctorName: '.doctor-name, .name, h1, h2, .title'
   ```

2. **Be specific**: Target the exact elements you need
   ```javascript
   phoneLinks: '.contact a[href^="tel:"], .phone-number a'
   ```

3. **Test selectors**: Use browser dev tools to verify selectors work

## Output Format

The scraper outputs data in this format:

```json
{
  "url": "https://example.com/doctor/john-smith",
  "title": "Dr. John Smith - Cardiologist",
  "extractedAt": "2024-01-15T10:30:00.000Z",
  "doctors": [
    {
      "name": "Dr. John Smith",
      "position": "Consultant Cardiologist",
      "links": [
        {
          "text": "Call: +65 6123 4567",
          "href": "tel:+6561234567"
        }
      ]
    }
  ],
  "totalDoctors": 1,
  "data": {
    "education": "MBBS, MD (Cardiology)",
    "experience": "15+ years",
    "languages": ["English", "Mandarin"]
  },
  "meta": {
    "description": "Leading cardiologist in Singapore",
    "keywords": "cardiology, heart, specialist"
  }
}
```

## Error Handling

The scraper handles errors gracefully:
- Failed URLs are recorded with error messages
- Continues processing remaining URLs
- Provides detailed logs for debugging

## Best Practices

1. **Start Small**: Test with a few URLs first
2. **Use Headless Mode**: Set `headless: true` for production
3. **Handle Rate Limiting**: Add delays between requests
4. **Monitor Output**: Check logs for any issues
5. **Validate Selectors**: Ensure selectors work across all target pages

## Examples

### Medical Directory Scraping
```javascript
scraperUrls: [
  'https://hospital.com/doctor/cardiology/dr-smith',
  'https://hospital.com/doctor/neurology/dr-jones',
  'https://hospital.com/doctor/oncology/dr-brown'
],
customSelectors: {
  doctorName: '.doctor-profile h1',
  specialty: '.specialty-tag',
  phoneLinks: '.contact-info a[href^="tel:"]',
  clinicAddress: '.clinic-details .address'
}
```

### Business Directory Scraping
```javascript
scraperUrls: [
  'https://directory.com/business/123',
  'https://directory.com/business/456'
],
customSelectors: {
  businessName: '.business-title h1',
  category: '.category-tag',
  phoneLinks: '.contact a[href^="tel:"]',
  website: '.website a',
  address: '.location .address',
  hours: '.business-hours'
}
```

## Troubleshooting

### No Data Extracted
- Check if selectors are correct using browser dev tools
- Verify the page has loaded completely
- Try broader selectors as fallbacks

### Missing URLs
- Ensure URLs are valid and accessible
- Check for redirects or authentication requirements
- Verify the site doesn't block automated access

### Performance Issues
- Reduce the number of concurrent requests
- Add delays between requests
- Use headless mode for better performance
