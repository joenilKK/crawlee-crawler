/**
 * Data extraction utilities for specialist information and flexible scraping
 */

/**
 * Extract doctor name from specialist page
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Doctor name
 */
export async function extractDoctorName(page, config) {
    try {
        await page.waitForSelector(config.SELECTORS.doctorName, { timeout: config.CRAWLER.timeout });
        
        const doctorName = await page.evaluate((selector) => {
            const nameElement = document.querySelector(selector);
            return nameElement ? nameElement.textContent.trim() : 'Name not found';
        }, config.SELECTORS.doctorName);
        
        return doctorName;
    } catch (error) {
        console.error('Error extracting doctor name:', error);
        return 'Name extraction failed';
    }
}


/**
 * Extract specialty from specialist page
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Doctor specialty
 */
export async function extractSpecialty(page, config) {
    try {
        await page.waitForSelector(config.SELECTORS.specialty, { timeout: config.CRAWLER.timeout });
        
        const specialties = await page.evaluate((selector) => {
            const specialtyElements = document.querySelectorAll(selector);
            const specialtyList = [];
            
            specialtyElements.forEach(element => {
                const specialty = element.textContent.trim();
                if (specialty) {
                    specialtyList.push(specialty);
                }
            });
            
            return specialtyList.length > 0 ? specialtyList : ['Specialty not found'];
        }, config.SELECTORS.specialty);
        
        return specialties;
    } catch (error) {
        console.error('Error extracting specialty:', error);
        return ['Specialty extraction failed'];
    }
}


/**
 * Extract contact details from specialist page
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<Array>} Array of contact details
 */
export async function extractContactDetails(page, config) {
    try {
        const contactDetails = await page.evaluate((selector) => {
            const contactElements = document.querySelectorAll(selector);
            const contacts = [];
            
            contactElements.forEach(element => {
                const text = element.textContent.trim();
                const href = element.href || '';
                if (text) {
                    contacts.push({
                        text: text,
                        link: href
                    });
                }
            });
            
            return contacts;
        }, config.SELECTORS.contactLinks);
        
        return contactDetails;
    } catch (error) {
        console.error('Error extracting contact details:', error);
        return [];
    }
}

/**
 * Extract data using flexible selectors with fallbacks
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector(s) separated by commas
 * @param {string} dataType - Type of data to extract ('text', 'link', 'image', 'attribute')
 * @param {string} attribute - Attribute name (for dataType 'attribute')
 * @returns {Promise<any>} Extracted data
 */
export async function extractWithFallback(page, selector, dataType = 'text', attribute = null) {
    const selectors = selector.split(',').map(s => s.trim());
    
    for (const sel of selectors) {
        try {
            await page.waitForSelector(sel, { timeout: 3000 });
            
            switch (dataType) {
                case 'text':
                    const textResult = await page.evaluate((s) => {
                        const elements = document.querySelectorAll(s);
                        if (elements.length === 0) return null;
                        if (elements.length === 1) return elements[0].textContent?.trim() || '';
                        return Array.from(elements).map(el => el.textContent?.trim() || '').filter(text => text);
                    }, sel);
                    if (textResult) return textResult;
                    break;
                    
                case 'link':
                    const linkResult = await page.evaluate((s) => {
                        const elements = document.querySelectorAll(s);
                        return Array.from(elements).map(link => ({
                            text: link.textContent?.trim() || '',
                            href: link.href || '',
                            title: link.title || ''
                        })).filter(link => link.href);
                    }, sel);
                    if (linkResult && linkResult.length > 0) return linkResult;
                    break;
                    
                case 'image':
                    const imageResult = await page.evaluate((s) => {
                        const elements = document.querySelectorAll(s);
                        return Array.from(elements).map(img => ({
                            src: img.src || img.dataset.src || img.getAttribute('data-lazy-src') || '',
                            alt: img.alt || '',
                            title: img.title || ''
                        })).filter(img => img.src);
                    }, sel);
                    if (imageResult && imageResult.length > 0) return imageResult;
                    break;
                    
                case 'attribute':
                    const attrResult = await page.evaluate((s, attr) => {
                        const elements = document.querySelectorAll(s);
                        if (elements.length === 0) return null;
                        if (elements.length === 1) return elements[0].getAttribute(attr);
                        return Array.from(elements).map(el => el.getAttribute(attr)).filter(val => val);
                    }, sel, attribute);
                    if (attrResult) return attrResult;
                    break;
            }
        } catch (error) {
            // Try next selector
            continue;
        }
    }
    
    return null;
}

/**
 * Extract all specialist data from a detail page
 * @param {Page} page - Playwright page object
 * @param {string} url - Current page URL
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Specialist data object
 */
export async function extractSpecialistData(page, url, config) {
    console.log(`Extracting data from specialist page: ${url}`);
    
    try {
        const doctorName = await extractDoctorName(page, config);
        const specialty = await extractSpecialty(page, config);
        const contactDetails = await extractContactDetails(page, config);
        
        const specialistData = {
            url: url,
            doctorName: doctorName,
            specialty: specialty,
            contactDetails: contactDetails,
            extractedAt: new Date().toISOString()
        };
        
        console.log(`Extracted data for: ${doctorName}`);
        console.log(`Specialty found: ${specialty}`);
        console.log(`Contact details found: ${contactDetails.length}`);
        
        return specialistData;
        
    } catch (error) {
        console.error(`Error extracting data from ${url}:`, error);
        
        return {
            url: url,
            doctorName: 'Extraction failed',
            contactDetails: [],
            error: error.message,
            extractedAt: new Date().toISOString()
        };
    }
}

/**
 * Extract data using custom selectors (for scraper-only mode)
 * @param {Page} page - Playwright page object
 * @param {string} url - Current page URL
 * @param {Object} customSelectors - Object with custom selector definitions
 * @returns {Promise<Object>} Extracted data object
 */
export async function extractCustomData(page, url, customSelectors = {}) {
    console.log(`Extracting custom data from: ${url}`);
    
    const extractedData = {
        url: url,
        title: await page.title(),
        extractedAt: new Date().toISOString(),
        data: {}
    };
    
    try {
        for (const [fieldName, selectorConfig] of Object.entries(customSelectors)) {
            try {
                // Handle nested structure for links
                if (Array.isArray(selectorConfig)) {
                    console.log(`🔗 Processing nested selectors for ${fieldName}`);
                    const nestedResults = [];
                    
                    for (const linkConfig of selectorConfig) {
                        if (typeof linkConfig === 'object' && linkConfig !== null) {
                            const linkData = {};
                            
                            for (const [linkName, linkSelector] of Object.entries(linkConfig)) {
                                try {
                                    let dataType = 'link'; // Default to link for nested structures
                                    
                                    // Override data type based on field name
                                    if (linkName.toLowerCase().includes('image') || linkName.toLowerCase().includes('img')) {
                                        dataType = 'image';
                                    } else if (linkName.toLowerCase().includes('text') || linkName.toLowerCase().includes('title')) {
                                        dataType = 'text';
                                    }
                                    
                                    const result = await extractWithFallback(page, linkSelector, dataType);
                                    linkData[linkName] = result;
                                    
                                    console.log(`  ✅ Extracted ${linkName}: ${Array.isArray(result) ? result.length + ' items' : 'data found'}`);
                                } catch (error) {
                                    console.log(`  ❌ Error extracting ${linkName}:`, error.message);
                                    linkData[linkName] = null;
                                }
                            }
                            
                            nestedResults.push(linkData);
                        }
                    }
                    
                    extractedData.data[fieldName] = nestedResults;
                } else if (typeof selectorConfig === 'string') {
                    // Handle simple string selectors (existing functionality)
                    let dataType = 'text';
                    
                    // Determine data type based on field name
                    if (fieldName.toLowerCase().includes('image') || fieldName.toLowerCase().includes('img')) {
                        dataType = 'image';
                    } else if (fieldName.toLowerCase().includes('link') || fieldName.toLowerCase().includes('url')) {
                        dataType = 'link';
                    }
                    
                    const result = await extractWithFallback(page, selectorConfig, dataType);
                    
                    if (result !== null) {
                        extractedData.data[fieldName] = result;
                        console.log(`✅ Extracted ${fieldName}: ${Array.isArray(result) ? result.length + ' items' : 'data found'}`);
                    } else {
                        console.log(`⚠️ No data found for ${fieldName} with selector: ${selectorConfig}`);
                        extractedData.data[fieldName] = null;
                    }
                } else {
                    console.log(`⚠️ Unsupported selector configuration for ${fieldName}`);
                    extractedData.data[fieldName] = null;
                }
                
            } catch (error) {
                console.log(`❌ Error extracting ${fieldName}:`, error.message);
                extractedData.data[fieldName] = null;
            }
        }
        
        // Extract page metadata
        extractedData.meta = await page.evaluate(() => {
            const meta = {};
            const metaTags = document.querySelectorAll('meta');
            metaTags.forEach(tag => {
                const name = tag.getAttribute('name') || tag.getAttribute('property') || tag.getAttribute('http-equiv');
                const content = tag.getAttribute('content');
                if (name && content) {
                    meta[name] = content;
                }
            });
            return meta;
        });
        
        console.log(`✅ Successfully extracted custom data from: ${url}`);
        return extractedData;
        
    } catch (error) {
        console.error(`❌ Error extracting custom data from ${url}:`, error);
        extractedData.error = error.message;
        return extractedData;
    }
}
