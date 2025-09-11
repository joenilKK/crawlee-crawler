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
                    
                    // Skip rows that contain only links (these are handled by contact extraction)
                    const hasOnlyLinks = cells[1].querySelectorAll('a').length > 0 && 
                                       cells[1].textContent.trim() === cells[1].querySelector('a')?.textContent?.trim();
                    
                    if (key && value && !hasOnlyLinks) {
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
        
        // Fallback: try to find any table-like structures
        try {
            const fallbackData = await page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                const businessOverview = [];
                
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const key = cells[0].textContent.trim();
                            const value = cells[1].textContent.trim();
                            
                            // Skip header rows and empty rows
                            if (key && value && !key.toLowerCase().includes('header')) {
                                businessOverview.push({
                                    key: key,
                                    value: value
                                });
                            }
                        }
                    });
                });
                
                return businessOverview;
            });
            
            console.log(`Using fallback table extraction, found ${fallbackData.length} table entries`);
            return fallbackData;
        } catch (fallbackError) {
            console.error('Fallback table extraction also failed:', fallbackError);
            return [];
        }
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
            const specialties = [];
            
            // Collect all specialties found
            for (let element of specialtyElements) {
                const text = element.textContent.trim();
                if (text) {
                    specialties.push(text);
                }
            }
            
            // Return as comma-separated string if multiple, or single specialty
            return specialties.length > 1 ? specialties.join(', ') : (specialties[0] || '');
        }, config.SELECTORS.specialty);
        
        return specialty;
    } catch (error) {
        console.error('Error extracting specialty:', error);
        
        // Fallback: try to find specialty-related text
        try {
            const fallbackSpecialty = await page.evaluate(() => {
                // Look for common specialty indicators
                const indicators = ['specialty', 'speciality', 'department', 'practice', 'field'];
                const allText = document.body.textContent.toLowerCase();
                
                for (let indicator of indicators) {
                    const regex = new RegExp(`${indicator}[:\\s]*([^\\n,]+)`, 'i');
                    const match = allText.match(regex);
                    if (match && match[1]) {
                        return match[1].trim();
                    }
                }
                
                return '';
            });
            
            console.log(`Using fallback specialty extraction: "${fallbackSpecialty}"`);
            return fallbackSpecialty;
        } catch (fallbackError) {
            console.error('Fallback specialty extraction also failed:', fallbackError);
            return '';
        }
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
        // Wait for the selector to be available
        await page.waitForSelector(config.SELECTORS.contactLinks, { timeout: config.CRAWLER.timeout });
        
        const contactDetails = await page.evaluate((selector) => {
            const contactElements = document.querySelectorAll(selector);
            const contacts = [];
            
            contactElements.forEach(element => {
                const text = element.textContent.trim();
                const href = element.href || '';
                
                // Extract additional context from the table row if available
                let context = '';
                const row = element.closest('tr');
                if (row) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        // First cell might contain label/type, second cell contains the link
                        context = cells[0].textContent.trim();
                    }
                }
                
                if (text) {
                    contacts.push({
                        text: text,
                        link: href,
                        type: context || 'Contact' // Use context as type or default to 'Contact'
                    });
                }
            });
            
            return contacts;
        }, config.SELECTORS.contactLinks);
        
        return contactDetails;
    } catch (error) {
        console.error('Error extracting contact details:', error);
        
        // Fallback: try to find any links that might be contact-related
        try {
            const fallbackContacts = await page.evaluate(() => {
                const allLinks = document.querySelectorAll('a[href]');
                const contacts = [];
                
                allLinks.forEach(link => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    
                    if (href.startsWith('tel:') || href.startsWith('mailto:') || 
                        text.includes('phone') || text.includes('email') || 
                        text.includes('contact') || /\d{4,}/.test(text)) {
                        
                        contacts.push({
                            text: text,
                            link: href,
                            type: 'Contact (fallback)'
                        });
                    }
                });
                
                return contacts;
            });
            
            console.log(`Using fallback contact extraction, found ${fallbackContacts.length} contacts`);
            return fallbackContacts;
        } catch (fallbackError) {
            console.error('Fallback contact extraction also failed:', fallbackError);
            return [];
        }
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
        
        // Flatten contact information for better table display
        const flattenedData = {
            url: url,
            doctorName: doctorName,
            specialty: specialty,
            extractedAt: new Date().toISOString()
        };
        
        // Add contact information as separate fields
        contact.forEach((contactItem, index) => {
            const suffix = contact.length > 1 ? `_${index + 1}` : '';
            flattenedData[`contact${suffix}_type`] = contactItem.type;
            flattenedData[`contact${suffix}_text`] = contactItem.text;
            flattenedData[`contact${suffix}_link`] = contactItem.link;
        });
        
        // Add business overview information as separate fields
        doctorinfo.forEach((info) => {
            // Clean the key to make it a valid field name
            const cleanKey = info.key.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            flattenedData[cleanKey] = info.value;
        });
        
        console.log(`Extracted data for: ${doctorName}`);
        return flattenedData;
        
    } catch (error) {
        console.error(`Error extracting data from ${url}:`, error);
        
        return {
            url: url,
            doctorName: 'Extraction failed',
            specialty: '',
            error: error.message,
            extractedAt: new Date().toISOString()
        };
    }
}

