/**
 * Enhanced debugging script to test selectors on MEMC specialist page
 */
import { PlaywrightCrawler } from 'crawlee';

const debugSelectors = async () => {
    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                headless: false,
                ignoreHTTPSErrors: true
            }
        },
        requestHandler: async ({ page }) => {
            
            // Wait for page load
            await page.waitForTimeout(5000);
            
            // Get basic page info
            const title = await page.title();
            const url = await page.url();
            console.log(`Page title: ${title}`);
            console.log(`Current URL: ${url}`);
            
            // Test various selector patterns
            const selectorTests = [
                '.specialist-list a.thumbnail',
                'a[href*="/specialist/"]',
                '.doctor-card a',
                '.specialist-card a',
                '.profile-card a',
                'a.thumbnail',
                '.card a',
                '.list-item a',
                '.specialist-item a',
                'a[href*="doctor"]',
                // Additional common patterns
                '.specialist-box a',
                '.profile-link',
                '.doctor-link',
                '.specialist-profile a',
                'a[class*="specialist"]',
                'a[class*="doctor"]',
                'a[class*="profile"]',
                '.content a[href*="specialist"]',
                '#content a[href*="specialist"]',
                '.main-content a[href*="specialist"]'
            ];
            
            
            for (const selector of selectorTests) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        
                        // Get details of first few elements
                        const details = await page.evaluate((sel) => {
                            const els = document.querySelectorAll(sel);
                            return Array.from(els).slice(0, 3).map(el => ({
                                text: el.textContent.trim().substring(0, 50),
                                href: el.href,
                                className: el.className
                            }));
                        }, selector);
                        
                        details.forEach((detail, i) => {
                        });
                    } else {
                    }
                } catch (error) {
                }
            }
            
            
            const specialistElements = await page.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                const matches = [];
                
                Array.from(allElements).forEach(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    const className = el.className?.toLowerCase() || '';
                    const id = el.id?.toLowerCase() || '';
                    const href = el.href?.toLowerCase() || '';
                    
                    if ((text.includes('specialist') || text.includes('doctor') ||
                         className.includes('specialist') || className.includes('doctor') ||
                         id.includes('specialist') || id.includes('doctor') ||
                         href.includes('specialist') || href.includes('doctor')) &&
                        el.tagName === 'A' && el.href) {
                        
                        matches.push({
                            tag: el.tagName,
                            text: el.textContent.trim().substring(0, 80),
                            href: el.href,
                            className: el.className,
                            id: el.id
                        });
                    }
                });
                
                return matches.slice(0, 10); // First 10 matches
            });
            
            const structure = await page.evaluate(() => {
                return {
                    hasSpecialistList: !!document.querySelector('.specialist-list'),
                    hasDoctorCard: !!document.querySelector('.doctor-card'),
                    hasProfileCard: !!document.querySelector('.profile-card'),
                    hasThumbnail: !!document.querySelector('.thumbnail'),
                    hasCard: !!document.querySelector('.card'),
                    totalLinks: document.querySelectorAll('a[href]').length,
                    bodyClasses: document.body.className,
                    mainContentSelectors: [
                        '.content',
                        '#content', 
                        '.main-content',
                        '#main-content',
                        '.page-content',
                        '.specialist-content'
                    ].map(sel => ({
                        selector: sel,
                        exists: !!document.querySelector(sel)
                    }))
                };
            });
            
            console.log('\n⏳ Browser staying open for 30 seconds for manual inspection...');
            console.log('💡 Check the browser to see the actual page structure!');
            await page.waitForTimeout(30000);
        }
    });
    
    await crawler.run(['https://www.memc.com.sg/specialist/']);
    console.log('✅ Debug completed!');
};

debugSelectors().catch(console.error);
