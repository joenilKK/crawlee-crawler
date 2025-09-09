/**
 * Example configuration for scraper-only mode
 * Copy this file to local-config.js to test scraper-only functionality
 */

export const LOCAL_CONFIG = {
    // Basic site information (still required for metadata)
    siteName: 'Example Medical Site',
    baseUrl: 'https://example.com/',
    startUrl: 'https://example.com/doctors/', // Not used in scraper mode
    
    // Required for validation (not used in scraper mode)
    allowedUrlPatterns: ['https://example.com/*'],
    paginationType: 'none',
    
    // Required selectors (not used in scraper mode)
    specialistLinksSelector: '.doctor-link',
    nextButtonSelector: '.next-button',
    nextButtonContainerSelector: '.pagination',
    doctorNameSelector: '.doctor-name',
    contactLinksSelector: '.contact-link',
    
    // Crawler settings
    maxRequestsPerCrawl: 50,
    headless: true, // Set to false for debugging
    timeout: 15000,
    
    // Enable scraper-only mode
    scraperMode: true,
    manualMode: false, // Set to true if you need to handle challenges manually
    
    // URLs to scrape in scraper-only mode
    scraperUrls: [
        'https://www.mountelizabeth.com.sg/patient-services/specialists/dr-tan-yew-oo',
        'https://www.mountelizabeth.com.sg/patient-services/specialists/dr-lim-cheok-peng',
        'https://www.mountelizabeth.com.sg/patient-services/specialists/dr-foo-keong-tatt'
    ],
    
    // Custom selectors for data extraction
    customSelectors: {
        // Doctor information selectors
        doctorName: '.profile-text .profile-name, .doctor-name, h1, h2',
        position: '.profile-specialty, .specialty, .position, .department',
        
        // Contact information selectors
        phoneLinks: '.mp-pac .mp-pac-box a.moe-vp-pac, .tel_number a, a[href^="tel:"], .phone a, .contact a',
        emailLinks: 'a[href^="mailto:"], .email a',
        
        // Additional information selectors
        education: '.education, .qualifications, .credentials',
        experience: '.experience, .background',
        specialties: '.specialties, .areas-of-interest',
        languages: '.languages, .spoken-languages',
        
        // Clinic/location information
        clinicName: '.clinic-name, .hospital-name, .practice-name',
        clinicAddress: '.address, .location, .clinic-address',
        
        // Container selectors (for structured extraction)
        doctorCards: '.doctor-card, .doctor-item, .profile-card, .specialist-card, .card',
        
        // Image selectors
        doctorImage: '.doctor-photo img, .profile-image img, .headshot img'
    },
    
    // Output settings
    outputFilename: 'scraped-doctors-data.json'
};
