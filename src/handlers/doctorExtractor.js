/**
 * Specialized data extractor for doctor/medical professional information
 */

/**
 * Extract structured doctor data from a page
 * @param {Page} page - Playwright page object
 * @param {string} url - Current page URL
 * @param {Object} customSelectors - Custom selector definitions
 * @returns {Promise<Object>} Extracted doctor data
 */
export async function extractDoctorData(page, url, customSelectors = {}) {
    console.log(`🏥 Extracting doctor data from: ${url}`);
    
    const extractedData = {
        url: url,
        title: await page.title(),
        extractedAt: new Date().toISOString(),
        doctors: []
    };

    try {
        // First, try to find doctor cards/containers
        const doctorCards = customSelectors.doctorCards || '.doctor-card, .doctor-item, .profile-card, .specialist-card, .card, .panel-card';
        
        // Extract doctors data by iterating through each doctor card
        const doctors = await page.evaluate((selectors) => {
            const doctorElements = document.querySelectorAll(selectors.doctorCards);
            const doctorsData = [];
            
            // If no doctor cards found, try to extract from the entire page as individual lists
            if (doctorElements.length === 0) {
                console.log('No doctor cards found, trying to extract from lists...');
                
                // Get all doctor names
                const nameElements = document.querySelectorAll(selectors.doctorName);
                const positionElements = document.querySelectorAll(selectors.position);
                const phoneElements = document.querySelectorAll(selectors.phoneLinks);
                
                // Match them by index (assuming they're in the same order)
                for (let i = 0; i < nameElements.length; i++) {
                    const nameEl = nameElements[i];
                    const positionEl = positionElements[i];
                    
                    if (nameEl && nameEl.textContent.trim()) {
                        const doctorData = {
                            name: nameEl.textContent.trim(),
                            position: positionEl ? positionEl.textContent.trim() : '',
                            links: []
                        };
                        
                        // Find phone links that might be associated with this doctor
                        // This is tricky without proper containers, so we'll try to find nearby phone links
                        const nearbyPhones = [];
                        
                        // Look for phone links near this name element
                        let currentElement = nameEl.parentElement;
                        let searchDepth = 0;
                        
                        while (currentElement && searchDepth < 3) {
                            const phones = currentElement.querySelectorAll(selectors.phoneLinks);
                            phones.forEach(phone => {
                                if (phone.textContent.trim() && phone.href) {
                                    nearbyPhones.push({
                                        text: phone.textContent.trim(),
                                        href: phone.href
                                    });
                                }
                            });
                            
                            if (nearbyPhones.length > 0) break;
                            
                            currentElement = currentElement.parentElement;
                            searchDepth++;
                        }
                        
                        doctorData.links = nearbyPhones;
                        doctorsData.push(doctorData);
                    }
                }
                
                return doctorsData;
            }
            
            // Process each doctor card
            doctorElements.forEach((card, index) => {
                try {
                    // Extract name from within this card
                    const nameEl = card.querySelector(selectors.doctorName);
                    const name = nameEl ? nameEl.textContent.trim() : `Doctor ${index + 1}`;
                    
                    // Extract position/specialty from within this card
                    const positionEl = card.querySelector(selectors.position);
                    const position = positionEl ? positionEl.textContent.trim() : '';
                    
                    // Extract phone links from within this card
                    const phoneLinks = [];
                    const phoneElements = card.querySelectorAll(selectors.phoneLinks);
                    
                    phoneElements.forEach(phone => {
                        if (phone.textContent.trim() && phone.href) {
                            phoneLinks.push({
                                text: phone.textContent.trim(),
                                href: phone.href
                            });
                        }
                    });
                    
                    if (name) {
                        doctorsData.push({
                            name: name,
                            position: position,
                            links: phoneLinks
                        });
                    }
                } catch (cardError) {
                    console.error(`Error processing doctor card ${index}:`, cardError);
                }
            });
            
            return doctorsData;
            
        }, {
            doctorCards: doctorCards,
            doctorName: customSelectors.doctorName || '.doctor-name, .name, h3, h4, .title',
            position: customSelectors.position || '.specialty, .position, .department, p, .description',
            phoneLinks: customSelectors.phoneLinks || '.tel_number a, a[href^="tel:"], .phone a, .contact a'
        });
        
        extractedData.doctors = doctors;
        extractedData.totalDoctors = doctors.length;
        
        console.log(`✅ Successfully extracted ${doctors.length} doctors from: ${url}`);
        
        // Log first few doctors for verification
        if (doctors.length > 0) {
            console.log('📋 Sample doctors extracted:');
            doctors.slice(0, 3).forEach((doctor, index) => {
                console.log(`   ${index + 1}. ${doctor.name} - ${doctor.position} (${doctor.links.length} phone numbers)`);
            });
        }
        
        return extractedData;
        
    } catch (error) {
        console.error(`❌ Error extracting doctor data from ${url}:`, error);
        extractedData.error = error.message;
        return extractedData;
    }
}

/**
 * Extract doctor data using fallback method (for pages without clear structure)
 * @param {Page} page - Playwright page object
 * @param {string} url - Current page URL  
 * @param {Object} customSelectors - Custom selector definitions
 * @returns {Promise<Object>} Extracted doctor data
 */
export async function extractDoctorDataFallback(page, url, customSelectors = {}) {
    console.log(`🔄 Using fallback extraction method for: ${url}`);
    
    try {
        // Try to extract by finding patterns in the page structure
        const doctors = await page.evaluate((selectors) => {
            const doctorsData = [];
            
            // Method 1: Look for name-position-phone patterns
            const nameElements = document.querySelectorAll(selectors.doctorName);
            
            nameElements.forEach((nameEl, index) => {
                const name = nameEl.textContent.trim();
                if (!name || name.length < 3) return; // Skip empty or too short names
                
                let position = '';
                let links = [];
                
                // Look for position in next sibling or nearby elements
                let nextEl = nameEl.nextElementSibling;
                let searchCount = 0;
                
                while (nextEl && searchCount < 5) {
                    const text = nextEl.textContent.trim();
                    
                    // Check if this looks like a medical specialty/position
                    if (text && (
                        text.includes('Surgery') || text.includes('Medicine') || 
                        text.includes('Cardiology') || text.includes('Oncology') ||
                        text.includes('Paediatric') || text.includes('Gynaecology') ||
                        text.includes('Orthopaedic') || text.includes('Neurology') ||
                        text.includes('Dermatology') || text.includes('Gastroenterology') ||
                        text.includes('Radiology') || text.includes('Anaesthesiology') ||
                        text.includes('Urology') || text.includes('Psychiatry') ||
                        text.includes('Respiratory') || text.includes('Ophthalmology') ||
                        text.includes('Otorhinolaryngology') || text.includes('Throat') ||
                        text.includes('Dentistry') || text.includes('Rheumatology')
                    )) {
                        position = text;
                        break;
                    }
                    
                    nextEl = nextEl.nextElementSibling;
                    searchCount++;
                }
                
                // Look for phone links in the vicinity
                let parentEl = nameEl.parentElement;
                let parentSearchCount = 0;
                
                while (parentEl && parentSearchCount < 3) {
                    const phoneEls = parentEl.querySelectorAll(selectors.phoneLinks);
                    
                    phoneEls.forEach(phone => {
                        if (phone.textContent.trim() && phone.href) {
                            links.push({
                                text: phone.textContent.trim(),
                                href: phone.href
                            });
                        }
                    });
                    
                    if (links.length > 0) break;
                    
                    parentEl = parentEl.parentElement;
                    parentSearchCount++;
                }
                
                doctorsData.push({
                    name: name,
                    position: position,
                    links: links
                });
            });
            
            return doctorsData;
            
        }, {
            doctorName: customSelectors.doctorName || '.doctor-name, .name, h3, h4, .title',
            position: customSelectors.position || '.specialty, .position, .department, p, .description',
            phoneLinks: customSelectors.phoneLinks || '.tel_number a, a[href^="tel:"], .phone a, .contact a'
        });
        
        return {
            url: url,
            title: await page.title(),
            extractedAt: new Date().toISOString(),
            doctors: doctors,
            totalDoctors: doctors.length,
            extractionMethod: 'fallback'
        };
        
    } catch (error) {
        console.error(`❌ Fallback extraction failed for ${url}:`, error);
        return {
            url: url,
            error: error.message,
            extractedAt: new Date().toISOString(),
            doctors: [],
            totalDoctors: 0
        };
    }
}
