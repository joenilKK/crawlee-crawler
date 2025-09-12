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
            
            tableRows.forEach(row => {
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
 * Extract unit number from specialist page
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Unit number
 */
export async function extractUnitNumber(page, config) {
    try {
        console.log(`Looking for unit number with selector: ${config.SELECTORS.unitNumber}`);
        
        // First try the configured selector
        const unitNumber = await extractWithFallback(page, config.SELECTORS.unitNumber, 'text');
        
        if (unitNumber) {
            console.log(`Found unit number with primary selector: ${unitNumber}`);
            // If we got an array, take the first non-empty result
            if (Array.isArray(unitNumber)) {
                return unitNumber.find(text => text && text.trim()) || '';
            }
            return unitNumber;
        }
        
        console.log('Primary selector failed, trying fallback methods...');
        
        // Fallback 1: Look for unit number in the contact area
        const fallbackResult = await page.evaluate(() => {
            const clinicContacts = document.querySelector('.clinic-contacts');
            if (!clinicContacts) {
                console.log('No .clinic-contacts found');
                return '';
            }
            
            const text = clinicContacts.textContent.trim();
            console.log('Clinic contacts text:', text);
            
            return text;
        });
        
        if (fallbackResult) {
            console.log(`Found unit number with fallback: ${fallbackResult}`);
            return fallbackResult;
        }
        
        // Fallback 2: Look for any element containing "unit" text
        const unitElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            const unitTexts = [];
            
            for (const element of elements) {
                const text = element.textContent?.trim();
                if (text && text.toLowerCase().includes('unit') && text.length < 50) {
                    unitTexts.push(text);
                }
            }
            
            return unitTexts;
        });
        
        console.log('All elements containing "unit":', unitElements);
        
        // Return the first unit text found
        if (unitElements.length > 0) {
            return unitElements[0];
        }
        
        console.log('No unit number found with any method');
        return '';
    } catch (error) {
        console.error('Error extracting unit number:', error);
        return '';
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
        const contact = await extractContactDetails(page, config);
        const doctorinfo = await extractTableData(page, config);
        const unitNumber = await extractUnitNumber(page, config);
        
        const specialistData = {
            extractedDate: new Date().toISOString().split('T')[0],
            url: url,
            doctorname: doctorName,
            specialty: specialty,
            contact: contact,
            businessOverview: doctorinfo,
            unitNumber: unitNumber,
            extractedAt: new Date().toISOString()
        };
        console.log(`Extracted data for: ${doctorName}`);
        return specialistData;
        
    } catch (error) {
        console.error(`Error extracting data from ${url}:`, error);
        
        return {
            extractedDate: new Date().toISOString().split('T')[0],
            url: url,
            doctorname: 'Extraction failed',
            specialty: '',
            contact: [],
            unitNumber: '',
            error: error.message,
            extractedAt: new Date().toISOString()
        };
    }
}

