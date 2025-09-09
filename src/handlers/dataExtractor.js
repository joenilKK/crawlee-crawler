/**
 * Data extraction utilities for specialist information
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
        const contactDetails = await extractContactDetails(page, config);
        
        const specialistData = {
            url: url,
            doctorName: doctorName,
            contactDetails: contactDetails,
            extractedAt: new Date().toISOString()
        };
        
        console.log(`Extracted data for: ${doctorName}`);
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
