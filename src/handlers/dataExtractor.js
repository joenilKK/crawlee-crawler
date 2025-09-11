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
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');
        
        // Try multiple selectors for doctor name with more specific ones first
        const selectors = [
            config.SELECTORS.doctorName,
            '.doctor-banner .doctor-profile h1',
            '.doctor-profile h1',
            '.doctor-banner h1',
            '.doctor-name h1',
            '.profile-header h1',
            '.doctor-title',
            'h1:not(.page-title):not(.site-title)',
            'h1'
        ];
        
        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                
                const doctorName = await page.evaluate((sel) => {
                    const nameElements = document.querySelectorAll(sel);
                    
                    // Try each element that matches the selector
                    for (let nameElement of nameElements) {
                        if (nameElement) {
                            let text = nameElement.textContent.trim();
                            
                            // Skip if the text is too short or obviously not a name
                            if (text.length < 3) continue;
                            
                            // Clean up common issues with concatenated text
                            text = text.replace(/Specialty.*$/i, '').trim();
                            text = text.replace(/Language\(s\) spoken.*$/i, '').trim();
                            text = text.replace(/View Profile.*$/i, '').trim();
                            
                            // Additional cleanup for edge cases
                            text = text.replace(/^View Profile\s*/i, '').trim();
                            text = text.replace(/\s*View Profile$/i, '').trim();
                            
                            // Remove common unwanted phrases
                            text = text.replace(/^(Dr\.\s+)?Profile\s*/i, '').trim();
                            text = text.replace(/\s*Profile$/i, '').trim();
                            text = text.replace(/^(Click to )?View\s*/i, '').trim();
                            
                            // Check if this looks like a doctor name (starts with Dr. or contains common name patterns)
                            if (text && 
                                (text.match(/^Dr\.?\s+[A-Z]/i) || // Starts with Dr.
                                 text.match(/^[A-Z][a-z]+\s+[A-Z]/i) || // First Last name pattern
                                 text.match(/^Prof\.?\s+/i) || // Professor
                                 text.match(/^A\/Prof\.?\s+/i))) { // Associate Professor
                                return text;
                            }
                            
                            // If no specific doctor title, but looks like a proper name, return it
                            if (text && 
                                text.length > 5 && 
                                text.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]*)*$/i) && // Proper name format
                                !text.toLowerCase().includes('view') &&
                                !text.toLowerCase().includes('profile') &&
                                !text.toLowerCase().includes('click') &&
                                !text.toLowerCase().includes('page') &&
                                !text.toLowerCase().includes('home')) {
                                return text;
                            }
                        }
                    }
                    return null;
                }, selector);
                
                if (doctorName && 
                    doctorName !== 'View Profile' && 
                    doctorName.toLowerCase() !== 'view profile' && 
                    doctorName.length > 2 && 
                    !doctorName.toLowerCase().includes('view profile')) {
                    return doctorName;
                }
            } catch (selectorError) {
                // Try next selector
                continue;
            }
        }
        
        // Final attempt: Try to find doctor name in page title or meta tags
        const titleBasedName = await page.evaluate(() => {
            const title = document.title;
            
            // Look for doctor name in title
            const titleMatch = title.match(/Dr\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]*)*|Prof\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]*)*|A\/Prof\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]*)*|[A-Z][a-z]+\s+[A-Z][a-z]+/i);
            if (titleMatch && titleMatch[0] && 
                !titleMatch[0].toLowerCase().includes('view') &&
                !titleMatch[0].toLowerCase().includes('profile') &&
                titleMatch[0].length > 5) {
                return titleMatch[0].trim();
            }
            
            return null;
        });
        
        if (titleBasedName) {
            return titleBasedName;
        }
        
        // Debug: Log page content to understand the structure
        const pageDebugInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                h1Elements: Array.from(document.querySelectorAll('h1')).map(h1 => ({
                    text: h1.textContent.trim(),
                    className: h1.className,
                    id: h1.id
                })),
                doctorProfileElements: Array.from(document.querySelectorAll('.doctor-profile, .profile, .doctor-details, .doctor-banner')).map(el => ({
                    className: el.className,
                    text: el.textContent.substring(0, 200).trim()
                })),
                allText: document.body.textContent.substring(0, 500).trim()
            };
        });
        
        return 'Name not found';
    } catch (error) {
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
        // Try multiple selectors for contact details
        const contactSelectors = [
            config.SELECTORS.contactLinks,
            '.clinic-item a',
            '.contact-info a',
            '.doctor-contact a',
            '.clinic-contacts a',
            'a[href*="tel:"]',
            'a[href*="mailto:"]'
        ];
        
        for (const selector of contactSelectors) {
            try {
                const contactDetails = await page.evaluate((sel) => {
                    const contactElements = document.querySelectorAll(sel);
                    const contacts = [];
                    
                    contactElements.forEach(element => {
                        const text = element.textContent.trim();
                        const href = element.href || '';
                        if (text && (href.includes('tel:') || href.includes('mailto:') || href.includes('http'))) {
                            contacts.push({
                                text: text,
                                link: href
                            });
                        }
                    });
                    
                    return contacts;
                }, selector);
                
                if (contactDetails && contactDetails.length > 0) {
                    return contactDetails;
                }
            } catch (selectorError) {
                // Try next selector
                continue;
            }
        }
        
        // If no contacts found with any selector, try to find phone numbers and emails in text
        const textBasedContacts = await page.evaluate(() => {
            const contacts = [];
            const bodyText = document.body.textContent;
            
            // Find phone numbers
            const phoneRegex = /(\+65\s?)?[689]\d{3}\s?\d{4}/g;
            const phones = bodyText.match(phoneRegex);
            if (phones) {
                phones.forEach(phone => {
                    contacts.push({
                        text: phone.trim(),
                        link: `tel:${phone.replace(/\s/g, '')}`
                    });
                });
            }
            
            // Find email addresses
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = bodyText.match(emailRegex);
            if (emails) {
                emails.forEach(email => {
                    contacts.push({
                        text: email.trim(),
                        link: `mailto:${email.trim()}`
                    });
                });
            }
            
            return contacts;
        });
        
        if (textBasedContacts.length > 0) {
            return textBasedContacts;
        }
        
        return [];
    } catch (error) {
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
    try {
        // Check if page is still open before proceeding
        if (page.isClosed()) {
            return null;
        }
        
        // Wait for page to be fully loaded with timeout
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        
        // Check if this is a valid doctor detail page
        const pageValidation = await page.evaluate(() => {
            const title = document.title.toLowerCase();
            const bodyText = document.body.textContent.toLowerCase();
            const pageLength = document.body.textContent.trim().length;
            
            return {
                hasError: title.includes('error') || title.includes('404') || 
                         bodyText.includes('page not found') || bodyText.includes('error'),
                hasContent: pageLength > 100,
                title: document.title,
                bodyPreview: document.body.textContent.substring(0, 300).trim(),
                hasDoctor: bodyText.includes('dr.') || bodyText.includes('doctor') || 
                          bodyText.includes('specialist') || bodyText.includes('physician') ||
                          bodyText.includes('prof.') || bodyText.includes('professor'),
                url: window.location.href
            };
        });
        
        if (pageValidation.hasError || !pageValidation.hasContent) {
            return null; // Return null for invalid pages so they can be filtered out
        }
        
         // If the page doesn't seem to contain doctor information, still try to extract
         // as it might be a valid doctor page without obvious keywords
        
        const doctorName = await extractDoctorName(page, config);
        const specialty = await extractSpecialty(page, config);
        const contact = await extractContactDetails(page, config);
        const doctorinfo = await extractTableData(page, config);
        
        // Enhanced validation for data quality
        const isValidDoctorName = doctorName && 
                                 doctorName !== 'Name not found' && 
                                 doctorName !== 'View Profile' && 
                                 doctorName !== 'Name extraction failed' &&
                                 doctorName !== 'Invalid page' &&
                                 doctorName.length > 2 &&
                                 !doctorName.toLowerCase().includes('view profile') &&
                                 !doctorName.toLowerCase().includes('click') &&
                                 !doctorName.toLowerCase().includes('profile');
        
         // Check if we have other meaningful data even if doctor name is questionable
        
        // Additional validation: check if we have at least some meaningful data
        const hasMeaningfulData = (doctorName && doctorName !== 'Name not found' && doctorName !== 'Name extraction failed') || 
                                 (specialty && specialty.length > 0) || 
                                 (contact && contact.length > 0);
        
        if (!hasMeaningfulData) {
            return null;
        }
        
        // If we have a questionable doctor name but other data, still include it
        // Keep the extracted name even if questionable, since we have other valid data
        
        const specialistData = {
            extractedDate: new Date().toISOString().split('T')[0], // Match the format in your JSON
            url: url,
            doctorname: doctorName,
            specialty: specialty,
            contact: contact,
            businessOverview: doctorinfo
        };
        
        return specialistData;
        
    } catch (error) {
        // Return null for failed extractions instead of bad data
        return null;
    }
}

