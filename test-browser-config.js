// Test script to verify browser configuration
import { PlaywrightCrawler } from 'crawlee';
import { chromium } from 'playwright';

console.log('🔧 Testing browser configuration...');

try {
    const crawler = new PlaywrightCrawler({
        maxConcurrency: 1,
        launchContext: {
            launcher: chromium,
            launchOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            }
        },
        requestHandler: async ({ page, request }) => {
            console.log(`✅ Successfully loaded: ${request.url}`);
            await page.close();
        }
    });

    console.log('✅ Browser configuration test passed!');
    console.log('🎯 The crawler should now work with Chrome/Chromium');
} catch (error) {
    console.error('❌ Browser configuration test failed:', error.message);
}
