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
    console.log(`   🔍 Starting doctor name extraction...`);
    const nameExtractionStartTime = Date.now();
    
    try {
        // Wait for page to be fully loaded
        console.log(`   ⏳ Waiting for page to be fully loaded...`);
        try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (loadError) {
            console.log(`   ⚠️  Page didn't reach networkidle, continuing anyway...`);
        }
        
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
                console.log(`   🎯 Trying selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 3000 });
                console.log(`   ✅ Selector found, extracting name...`);
                
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
                    console.log(`   ✅ Doctor name found with selector "${selector}": "${doctorName}"`);
                    console.log(`   ⏱️  Name extraction completed in ${Date.now() - nameExtractionStartTime}ms`);
                    return doctorName;
                }
                console.log(`   ❌ Invalid name found with selector "${selector}": "${doctorName}"`);
            } catch (selectorError) {
                console.log(`   ❌ Selector "${selector}" failed: ${selectorError.message}`);
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
            console.log(`   ✅ Doctor name found in title: "${titleBasedName}"`);
            console.log(`   ⏱️  Name extraction completed in ${Date.now() - nameExtractionStartTime}ms`);
            return titleBasedName;
        }
        
        console.log(`   🔍 No name found, gathering debug information...`);
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
        
        console.log(`   📊 Debug information:`);
        console.log(`      - Page title: ${pageDebugInfo.title}`);
        console.log(`      - H1 elements found: ${pageDebugInfo.h1Elements.length}`);
        console.log(`      - Doctor profile elements found: ${pageDebugInfo.doctorProfileElements.length}`);
        console.log(`      - Body text preview: ${pageDebugInfo.allText.substring(0, 100)}...`);
        
        console.log(`   ❌ Name extraction failed - returning "Name not found"`);
        console.log(`   ⏱️  Name extraction completed in ${Date.now() - nameExtractionStartTime}ms`);
        return 'Name not found';
    } catch (error) {
        console.error(`   ❌ Error during name extraction:`, error.message);
        console.log(`   ⏱️  Name extraction failed in ${Date.now() - nameExtractionStartTime}ms`);
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
    console.log(`   🔍 Starting table data extraction with selector: ${config.SELECTORS.tableRows}`);
    const tableStartTime = Date.now();
    
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
        
        console.log(`   ✅ Table data extraction completed in ${Date.now() - tableStartTime}ms: ${tableData.length} rows found`);
        return tableData;
    } catch (error) {
        console.error(`   ❌ Error during table data extraction:`, error.message);
        console.log(`   ⏱️  Table data extraction failed in ${Date.now() - tableStartTime}ms`);
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
    console.log(`   🔍 Starting specialty extraction with selector: ${config.SELECTORS.specialty}`);
    const specialtyStartTime = Date.now();
    
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
        
        console.log(`   ✅ Specialty extraction completed in ${Date.now() - specialtyStartTime}ms: "${specialty}"`);
        return specialty;
    } catch (error) {
        console.error(`   ❌ Error during specialty extraction:`, error.message);
        console.log(`   ⏱️  Specialty extraction failed in ${Date.now() - specialtyStartTime}ms`);
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
    console.log(`   🔍 Starting contact details extraction...`);
    const contactStartTime = Date.now();
    
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
        
        console.log(`   🎯 Trying ${contactSelectors.length} contact selectors...`);
        
        for (const selector of contactSelectors) {
            try {
                console.log(`   🎯 Trying contact selector: ${selector}`);
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
                    console.log(`   ✅ Found ${contactDetails.length} contacts with selector: ${selector}`);
                    console.log(`   ⏱️  Contact extraction completed in ${Date.now() - contactStartTime}ms`);
                    return contactDetails;
                }
                console.log(`   ❌ No contacts found with selector: ${selector}`);
            } catch (selectorError) {
                console.log(`   ❌ Contact selector failed: ${selector} - ${selectorError.message}`);
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
            console.log(`   ✅ Found ${textBasedContacts.length} contacts using text-based extraction`);
            console.log(`   ⏱️  Contact extraction completed in ${Date.now() - contactStartTime}ms`);
            return textBasedContacts;
        }
        
        console.log(`   ❌ No contacts found with any method`);
        console.log(`   ⏱️  Contact extraction completed in ${Date.now() - contactStartTime}ms`);
        return [];
    } catch (error) {
        console.error(`   ❌ Error during contact extraction:`, error.message);
        console.log(`   ⏱️  Contact extraction failed in ${Date.now() - contactStartTime}ms`);
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
    const extractionStartTime = Date.now();
    console.log(`\n🔍 Starting specialist data extraction for: ${url}`);
    
    try {
        // Check if page is still open before proceeding
        if (page.isClosed()) {
            console.log(`❌ Page is closed, cannot extract data from: ${url}`);
            return null;
        }
        
        console.log(`⏳ Waiting for page to reach networkidle state...`);
        const loadStateStartTime = Date.now();
        
        // Wait for page to be fully loaded with timeout
        try {
            await page.waitForLoadState('networkidle', { timeout: 20000 }); // Reduced from 30s to 20s
            console.log(`✅ Page loaded in ${Date.now() - loadStateStartTime}ms`);
        } catch (loadError) {
            console.log(`⚠️  Page didn't reach networkidle in 20s, trying domcontentloaded...`);
            try {
                await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
                console.log(`✅ Page DOM loaded in ${Date.now() - loadStateStartTime}ms`);
                // Add small wait for dynamic content
                await page.waitForTimeout(3000);
            } catch (domError) {
                console.error(`❌ Page failed to load properly: ${domError.message}`);
                return null;
            }
        }
        
        // Wait for actual content to load beyond GTM - try waiting for doctor-specific elements
        console.log(`⏳ Waiting for doctor-specific content to load...`);
        const contentWaitStartTime = Date.now();
        try {
            // Wait for any of the doctor-specific selectors to appear
            const doctorSelectors = [
                config.SELECTORS.doctorName,
                '.doctor-banner',
                '.doctor-profile',
                '.doctor-info',
                '.profile-details'
            ];
            
            let contentFound = false;
            for (const selector of doctorSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 8000 });
                    console.log(`✅ Doctor content found with selector: ${selector} in ${Date.now() - contentWaitStartTime}ms`);
                    contentFound = true;
                    break;
                } catch (selectorError) {
                    // Try next selector
                    continue;
                }
            }
            
            if (!contentFound) {
                console.log(`⚠️  No doctor-specific content found, but continuing with extraction...`);
            }
            
            // Additional wait to ensure any dynamic content has loaded
            await page.waitForTimeout(2000);
            
        } catch (contentError) {
            console.log(`⚠️  Error waiting for doctor content: ${contentError.message}, but continuing...`);
        }
        
        console.log(`🔍 Validating page content...`);
        const validationStartTime = Date.now();
        
        // Check if this is a valid doctor detail page
        const pageValidation = await page.evaluate(() => {
            const title = document.title.toLowerCase();
            const bodyText = document.body.textContent.toLowerCase();
            const pageLength = document.body.textContent.trim().length;
            const bodyHTML = document.body.innerHTML.toLowerCase();
            
            // Check for common invalid page indicators
            const hasOnlyIframes = bodyHTML.includes('<iframe') && 
                                  bodyHTML.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '').replace(/\s/g, '').length < 100;
            
            const hasGoogleTagManager = bodyHTML.includes('googletagmanager') || 
                                       bodyText.includes('google tag manager');
            
            const hasRedirectScript = bodyHTML.includes('window.location') || 
                                     bodyHTML.includes('document.location') ||
                                     bodyHTML.includes('location.href');
            
            const isLoadingPage = bodyText.includes('loading') && pageLength < 500;
            
            const hasMinimalContent = pageLength < 200 && !bodyText.includes('dr.') && !bodyText.includes('doctor');
            
        // Check if page is mostly empty or just has tracking scripts
        const meaningfulTextLength = bodyText
            .replace(/google tag manager/gi, '')
            .replace(/gtm/gi, '')
            .replace(/analytics/gi, '')
            .replace(/tracking/gi, '')
            .replace(/facebook/gi, '')
            .replace(/pixel/gi, '')
            .replace(/dataLayer/gi, '')
            .replace(/\s+/g, ' ')
            .trim().length;
            
            return {
                hasError: title.includes('error') || title.includes('404') || 
                         bodyText.includes('page not found') || bodyText.includes('error') ||
                         title.includes('not found') || title.includes('access denied'),
                hasContent: pageLength > 100 && meaningfulTextLength > 50,
                hasOnlyIframes: hasOnlyIframes,
                hasGoogleTagManager: hasGoogleTagManager,
                hasRedirectScript: hasRedirectScript,
                isLoadingPage: isLoadingPage,
                hasMinimalContent: hasMinimalContent,
                title: document.title,
                bodyPreview: document.body.textContent.substring(0, 300).trim(),
                hasDoctor: bodyText.includes('dr.') || bodyText.includes('doctor') || 
                          bodyText.includes('specialist') || bodyText.includes('physician') ||
                          bodyText.includes('prof.') || bodyText.includes('professor'),
                url: window.location.href,
                pageLength: pageLength,
                meaningfulTextLength: meaningfulTextLength
            };
        });
        
        console.log(`✅ Page validation completed in ${Date.now() - validationStartTime}ms`);
        console.log(`📊 Page validation results:`);
        console.log(`   - Title: ${pageValidation.title}`);
        console.log(`   - Content length: ${pageValidation.pageLength} characters`);
        console.log(`   - Meaningful text length: ${pageValidation.meaningfulTextLength} characters`);
        console.log(`   - Has error: ${pageValidation.hasError}`);
        console.log(`   - Has content: ${pageValidation.hasContent}`);
        console.log(`   - Has only iframes: ${pageValidation.hasOnlyIframes}`);
        console.log(`   - Has Google Tag Manager: ${pageValidation.hasGoogleTagManager}`);
        console.log(`   - Has redirect script: ${pageValidation.hasRedirectScript}`);
        console.log(`   - Is loading page: ${pageValidation.isLoadingPage}`);
        console.log(`   - Has minimal content: ${pageValidation.hasMinimalContent}`);
        console.log(`   - Has doctor keywords: ${pageValidation.hasDoctor}`);
        console.log(`   - Body preview: ${pageValidation.bodyPreview.substring(0, 100)}...`);
        
        // Enhanced validation to catch problematic pages, but be less aggressive with GTM
        const shouldSkipPage = pageValidation.hasError || 
                              !pageValidation.hasContent || 
                              pageValidation.hasOnlyIframes ||
                              pageValidation.isLoadingPage ||
                              (pageValidation.hasMinimalContent && !pageValidation.hasDoctor);
        
        if (shouldSkipPage) {
            console.log(`❌ Page validation failed - invalid or problematic page: ${url}`);
            console.log(`   - Has error: ${pageValidation.hasError}`);
            console.log(`   - Has content: ${pageValidation.hasContent}`);
            console.log(`   - Has only iframes: ${pageValidation.hasOnlyIframes}`);
            console.log(`   - Has Google Tag Manager: ${pageValidation.hasGoogleTagManager}`);
            console.log(`   - Is loading page: ${pageValidation.isLoadingPage}`);
            console.log(`   - Has minimal content: ${pageValidation.hasMinimalContent}`);
            return null; // Return null for invalid pages so they can be filtered out
        }
        
        // Special handling for GTM pages - give them a chance if they have doctor content
        if (pageValidation.hasGoogleTagManager && !pageValidation.hasDoctor) {
            console.log(`⚠️  Page has Google Tag Manager but no doctor keywords - trying to wait for content...`);
            
            // Try to disable GTM and other tracking scripts that might interfere
            try {
                await page.evaluate(() => {
                    // Try to stop GTM and other tracking
                    if (window.gtag) window.gtag = () => {};
                    if (window.dataLayer) window.dataLayer = [];
                    if (window.ga) window.ga = () => {};
                    
                    // Remove GTM iframes that might be blocking content
                    const gtmIframes = document.querySelectorAll('iframe[src*="googletagmanager"]');
                    gtmIframes.forEach(iframe => iframe.remove());
                    
                    // Remove noscript tags that might contain fallback content
                    const noscripts = document.querySelectorAll('noscript');
                    noscripts.forEach(ns => ns.remove());
                });
                console.log(`🧹 Cleaned up tracking scripts and GTM content`);
            } catch (cleanupError) {
                console.log(`⚠️  Error cleaning up tracking scripts: ${cleanupError.message}`);
            }
            
            // Wait a bit more for potential dynamic content loading
            console.log(`⏳ Waiting 8 seconds for dynamic content to load after cleanup...`);
            await page.waitForTimeout(8000);
            
            // Try to trigger any lazy loading or dynamic content
            try {
                await page.evaluate(() => {
                    // Scroll to trigger lazy loading
                    window.scrollTo(0, document.body.scrollHeight);
                    
                    // Try to click any "load more" or similar buttons
                    const loadButtons = document.querySelectorAll('button, a');
                    for (const btn of loadButtons) {
                        const text = btn.textContent.toLowerCase();
                        if (text.includes('load') || text.includes('show') || text.includes('more')) {
                            btn.click();
                            break;
                        }
                    }
                });
                console.log(`🔄 Triggered potential dynamic content loading`);
            } catch (triggerError) {
                console.log(`⚠️  Error triggering dynamic content: ${triggerError.message}`);
            }
            
            // Wait a bit more after triggering
            await page.waitForTimeout(3000);
            
            // Re-validate after waiting and cleanup
            const reValidation = await page.evaluate(() => {
                const bodyText = document.body.textContent.toLowerCase();
                const bodyHTML = document.body.innerHTML.toLowerCase();
                
                return {
                    hasDoctor: bodyText.includes('dr.') || bodyText.includes('doctor') || 
                              bodyText.includes('specialist') || bodyText.includes('physician') ||
                              bodyText.includes('prof.') || bodyText.includes('professor'),
                    pageLength: document.body.textContent.trim().length,
                    hasFormElements: bodyHTML.includes('<form') || bodyHTML.includes('<input') || bodyHTML.includes('<select'),
                    hasImages: bodyHTML.includes('<img'),
                    hasLinks: bodyHTML.includes('<a href'),
                    bodyPreview: document.body.textContent.substring(0, 500).trim()
                };
            });
            
            console.log(`📊 Re-validation results after cleanup:`);
            console.log(`   - Has doctor keywords: ${reValidation.hasDoctor}`);
            console.log(`   - Page length: ${reValidation.pageLength}`);
            console.log(`   - Has form elements: ${reValidation.hasFormElements}`);
            console.log(`   - Has images: ${reValidation.hasImages}`);
            console.log(`   - Has links: ${reValidation.hasLinks}`);
            console.log(`   - Body preview: ${reValidation.bodyPreview.substring(0, 100)}...`);
            
            if (!reValidation.hasDoctor && reValidation.pageLength < 500 && !reValidation.hasFormElements) {
                console.log(`❌ Page still has no meaningful content after cleanup and waiting - skipping: ${url}`);
                return null;
            }
            
            console.log(`✅ Content found after waiting and cleanup for GTM page`);
        }
        
        console.log(`✅ Page validation passed, proceeding with data extraction...`);
        
         // If the page doesn't seem to contain doctor information, still try to extract
         // as it might be a valid doctor page without obvious keywords
        
        console.log(`👨‍⚕️ Extracting doctor name...`);
        const nameStartTime = Date.now();
        const doctorName = await extractDoctorName(page, config);
        console.log(`✅ Doctor name extracted in ${Date.now() - nameStartTime}ms: "${doctorName}"`);
        
        console.log(`🏥 Extracting specialty information...`);
        const specialtyStartTime = Date.now();
        const specialty = await extractSpecialty(page, config);
        console.log(`✅ Specialty extracted in ${Date.now() - specialtyStartTime}ms: "${specialty}"`);
        
        console.log(`📞 Extracting contact details...`);
        const contactStartTime = Date.now();
        const contact = await extractContactDetails(page, config);
        console.log(`✅ Contact details extracted in ${Date.now() - contactStartTime}ms: ${contact.length} contacts found`);
        
        console.log(`📋 Extracting table/business overview data...`);
        const tableStartTime = Date.now();
        const doctorinfo = await extractTableData(page, config);
        console.log(`✅ Table data extracted in ${Date.now() - tableStartTime}ms: ${doctorinfo.length} table rows found`);
        
        console.log(`\n🔍 Validating extracted data quality...`);
        
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
        
        console.log(`📊 Data quality validation results:`);
        console.log(`   - Doctor name valid: ${isValidDoctorName}`);
        console.log(`   - Specialty present: ${specialty && specialty.length > 0}`);
        console.log(`   - Contact info present: ${contact && contact.length > 0}`);
        console.log(`   - Table data present: ${doctorinfo && doctorinfo.length > 0}`);
        
         // Check if we have other meaningful data even if doctor name is questionable
        
        // Additional validation: check if we have at least some meaningful data
        const hasMeaningfulData = (doctorName && doctorName !== 'Name not found' && doctorName !== 'Name extraction failed') || 
                                 (specialty && specialty.length > 0) || 
                                 (contact && contact.length > 0);
        
        console.log(`📊 Has meaningful data: ${hasMeaningfulData}`);
        
        if (!hasMeaningfulData) {
            console.log(`❌ No meaningful data found, returning null for: ${url}`);
            return null;
        }
        
        // If we have a questionable doctor name but other data, still include it
        // Keep the extracted name even if questionable, since we have other valid data
        
        console.log(`✅ Creating specialist data object...`);
        const specialistData = {
            extractedDate: new Date().toISOString().split('T')[0], // Match the format in your JSON
            url: url,
            doctorname: doctorName,
            specialty: specialty,
            contact: contact,
            businessOverview: doctorinfo
        };
        
        const totalExtractionTime = Date.now() - extractionStartTime;
        console.log(`🎉 Specialist data extraction completed successfully!`);
        console.log(`📊 Final extracted data summary:`);
        console.log(`   - Doctor name: "${doctorName}"`);
        console.log(`   - Specialty: "${specialty}"`);
        console.log(`   - Contact details: ${contact.length} items`);
        console.log(`   - Business overview: ${doctorinfo.length} items`);
        console.log(`⏱️  Total extraction time: ${totalExtractionTime}ms (${Math.round(totalExtractionTime/1000)}s)`);
        
        return specialistData;
        
    } catch (error) {
        const totalExtractionTime = Date.now() - extractionStartTime;
        console.error(`❌ Error during specialist data extraction for ${url}:`, error.message);
        console.error(`🔍 Error stack:`, error.stack);
        console.error(`⏱️  Failed after ${totalExtractionTime}ms (${Math.round(totalExtractionTime/1000)}s)`);
        
        // Return null for failed extractions instead of bad data
        return null;
    }
}

