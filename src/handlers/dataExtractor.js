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
        
        const entityName = await page.evaluate((selector) => {
            const nameElement = document.querySelector(selector);
            if (nameElement) {
                // Clean up the text - remove any <small> tags or line breaks
                let text = nameElement.textContent.trim();
                // Remove any trailing newlines or extra whitespace
                text = text.replace(/\s+/g, ' ').trim();
                return text;
            }
            return 'Name not found';
        }, config.SELECTORS.doctorName);
        
        console.log(`Extracted entity name: ${entityName}`);
        return entityName;
    } catch (error) {
        console.error('Error extracting entity name:', error);
        return 'Name extraction failed';
    }
}

/**
 * Extract table data as key-value pairs from table rows
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<Array>} Array of table row data
 */
export async function extractTableData(page, config) {
    try {
        const tableData = await page.evaluate((selector) => {
            const tableRows = document.querySelectorAll(selector);
            const businessOverview = [];
            
            tableRows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                
                if (cells.length >= 2) {
                    const key = cells[0].textContent.trim();
                    const value = cells[1].textContent.trim();
                    
                    if (key && value) {
                        businessOverview.push({
                            key: key,
                            value: value
                        });
                    }
                }
            });
            
            return businessOverview;
        }, config.SELECTORS.tableRows);
        
        console.log(`Table extraction completed. Found ${tableData.length} overview items for entity.`);
        return tableData;
    } catch (error) {
        console.error('Error extracting table data:', error);
        return [];
    }
}

/**
 * Extract specialty information from specialist page
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Specialty string
 */
export async function extractSpecialty(page, config) {
    try {
        // Skip if selector is empty or not provided
        if (!config.SELECTORS.specialty || config.SELECTORS.specialty.trim() === '') {
            return '';
        }
        
        const specialty = await page.evaluate((selector) => {
            const specialtyElements = document.querySelectorAll(selector);
            
            // Get the first specialty found
            for (let element of specialtyElements) {
                const text = element.textContent.trim();
                if (text) {
                    return text;
                }
            }
            
            return '';
        }, config.SELECTORS.specialty);
        
        return specialty;
    } catch (error) {
        console.error('Error extracting specialty:', error);
        return '';
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
        // Skip if selector is empty or not provided
        if (!config.SELECTORS.contactLinks || config.SELECTORS.contactLinks.trim() === '') {
            return [];
        }
        
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
    console.log(`Extracting data from corporate entity page: ${url}`);
    
    try {
        const entityName = await extractDoctorName(page, config);
        const overviewData = await extractTableData(page, config);
        
        const entityData = {
            url: url,
            entityName: entityName,
            overview: overviewData,
            extractedAt: new Date().toISOString()
        };
        console.log(`Extracted data for: ${entityName}`);
        return entityData;
        
    } catch (error) {
        console.error(`Error extracting data from ${url}:`, error);
        
        return {
            url: url,
            entityName: 'Extraction failed',
            overview: [],
            error: error.message,
            extractedAt: new Date().toISOString()
        };
    }
}

