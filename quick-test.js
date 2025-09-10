/**
 * Quick test to see what's on the MEMC specialist page
 */
import { PlaywrightCrawler } from 'crawlee';

const quickTest = async () => {
    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                headless: false,
                ignoreHTTPSErrors: true
            }
        },
        requestHandler: async ({ page }) => {
            console.log('🔍 Analyzing MEMC specialist page...');
            
            // Wait for page load
            await page.waitForTimeout(3000);
            
            // Get basic page info
            const title = await page.title();
            console.log(`Page title: ${title}`);
            
            // Look for any links that might be specialist profiles
            const analysis = await page.evaluate(() => {
                const allLinks = Array.from(document.querySelectorAll('a[href]'));
                
                // Find links that look like specialist profiles
                const possibleSpecialistLinks = allLinks.filter(link => {
                    const href = link.href.toLowerCase();
                    const text = link.textContent.toLowerCase();
                    
                    return (
                        href.includes('specialist') || 
                        href.includes('doctor') ||
                        text.includes('dr.') ||
                        text.includes('doctor') ||
                        text.includes('specialist')
                    );
                });
                
                // Also check for common patterns
                const cardLinks = allLinks.filter(link => {
                    const classes = link.className.toLowerCase();
                    return classes.includes('card') || classes.includes('profile') || classes.includes('thumbnail');
                });
                
                return {
                    totalLinks: allLinks.length,
                    possibleSpecialistLinks: possibleSpecialistLinks.slice(0, 10).map(link => ({
                        text: link.textContent.trim().substring(0, 60),
                        href: link.href,
                        className: link.className
                    })),
                    cardLinks: cardLinks.slice(0, 5).map(link => ({
                        text: link.textContent.trim().substring(0, 60),
                        href: link.href,
                        className: link.className
                    }))
                };
            });
            
            console.log(`\nTotal links found: ${analysis.totalLinks}`);
            
            console.log(`\nPossible specialist links (${analysis.possibleSpecialistLinks.length}):`);
            analysis.possibleSpecialistLinks.forEach((link, i) => {
                console.log(`${i + 1}. "${link.text}" (class: "${link.className}")`);
                console.log(`   URL: ${link.href}`);
            });
            
            console.log(`\nCard-like links (${analysis.cardLinks.length}):`);
            analysis.cardLinks.forEach((link, i) => {
                console.log(`${i + 1}. "${link.text}" (class: "${link.className}")`);
                console.log(`   URL: ${link.href}`);
            });
            
            // Test your current selector
            console.log('\n🧪 Testing your current selector ".specialist-list a.thumbnail":');
            try {
                const elements = await page.$$('.specialist-list a.thumbnail');
                console.log(`Found: ${elements.length} elements`);
                
                if (elements.length === 0) {
                    // Check if .specialist-list exists
                    const specialistList = await page.$('.specialist-list');
                    console.log(`.specialist-list exists: ${specialistList !== null}`);
                    
                    // Check if a.thumbnail exists anywhere
                    const thumbnails = await page.$$('a.thumbnail');
                    console.log(`a.thumbnail found anywhere: ${thumbnails.length}`);
                }
            } catch (error) {
                console.log(`Error: ${error.message}`);
            }
            
            console.log('\n⏳ Browser staying open for 20 seconds for manual inspection...');
            await page.waitForTimeout(20000);
        }
    });
    
    await crawler.run(['https://www.memc.com.sg/specialist/']);
    console.log('✅ Test completed!');
};

quickTest().catch(console.error);
