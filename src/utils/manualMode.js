/**
 * Manual mode utilities for user interaction
 */

/**
 * Wait for user to manually handle challenges or interactions
 * @param {Page} page - Playwright page
 * @param {string} url - Current URL
 * @param {string} reason - Reason for waiting
 * @returns {Promise<boolean>} True when user confirms to continue
 */
export async function waitForManualIntervention(page, url, reason = 'manual intervention') {
    console.log('\n🚨 MANUAL INTERVENTION REQUIRED 🚨');
    console.log(`📍 URL: ${url}`);
    console.log(`💡 Reason: ${reason}`);
    
    // Host-specific guidance
    const hostname = new URL(url).hostname;
    if (hostname.includes('sgpbusiness.com')) {
        console.log('\n🚨 SGP BUSINESS - ULTRA AGGRESSIVE PROTECTION 🚨');
        console.log('This site is known to be extremely difficult to access:');
        console.log('');
        console.log('📋 STEP-BY-STEP INSTRUCTIONS:');
        console.log('1. ⏰ Wait for challenge to appear');
        console.log('2. 🚫 DO NOT CLICK ANYTHING - let it run automatically');
        console.log('3. ⏳ Wait 60+ seconds for challenge to complete');
        console.log('4. 👀 Look for "Success" or page content to appear');
        console.log('5. 🔄 If it loops back to challenge, wait 5+ minutes and refresh');
        console.log('6. 🌐 If page stays white, try navigating to a simpler page first');
        console.log('');
        console.log('💡 ALTERNATIVE APPROACHES:');
        console.log('• Try accessing the site in a regular browser first');
        console.log('• Clear all cookies and try again');
        console.log('• Try from a different IP/network if possible');
        console.log('• Consider using the site during off-peak hours');
        console.log('');
        console.log('⚠️  This may take several attempts and patience!');
    }
    
    console.log('👀 Browser window should be visible for you to interact with');
    console.log('🔧 Please handle any challenges, login, or other interactions needed');
    console.log('⏳ Waiting for you to complete...\n');

    // Wait for user input
    return new Promise(async (resolve) => {
        const { createInterface } = await import('readline');
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('✅ Press ENTER when you have completed the manual steps and want to continue...', async () => {
            rl.close();
            console.log('🚀 Continuing with crawling...\n');
            
            try {
                // After manual intervention, wait a moment and check the page state
                console.log('🔄 Checking page state after manual intervention...');
                
                // Host-specific wait times
                const hostname = new URL(page.url()).hostname;
                let waitTime = 3000;
                if (hostname.includes('sgpbusiness.com')) {
                    waitTime = 20000; // Much longer wait for SGP Business
                    console.log('⏰ Using extended wait time for SGP Business (20 seconds)...');
                    
                    // For SGP Business, check if we're in a challenge loop
                    const isInChallengeLoop = await checkForChallengeLoop(page);
                    if (isInChallengeLoop) {
                        console.log('🔄 Detected challenge loop - may need to wait longer or try different approach');
                    }
                }
                
                await page.waitForTimeout(waitTime);
                
                // Check current URL - it might have changed after challenge completion
                const currentUrl = page.url();
                console.log(`📍 Current URL: ${currentUrl}`);
                
                // If URL changed significantly, the challenge was likely completed
                if (currentUrl !== url && !currentUrl.includes('challenge') && !currentUrl.includes('security')) {
                    console.log('✅ URL changed - challenge appears to be completed');
                    resolve(true);
                    return;
                }
                
                // Check if we're still on a challenge page
                const stillHasChallenge = await checkForManualIntervention(page);
                if (stillHasChallenge) {
                    console.log('⚠️ Challenge elements still detected after manual intervention');
                    console.log('🔄 Trying to refresh the page...');
                    
                    // Try refreshing the page
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(5000);
                    
                    // Check again after refresh
                    const stillHasChallengeAfterRefresh = await checkForManualIntervention(page);
                    if (stillHasChallengeAfterRefresh) {
                        console.log('❌ Challenge still present after refresh - you may need to complete it again');
                    } else {
                        console.log('✅ Challenge cleared after refresh');
                    }
                } else {
                    console.log('✅ No challenge elements detected - continuing');
                }
                
            } catch (error) {
                console.log(`⚠️ Error checking page state: ${error.message}`);
                console.log('🚀 Continuing anyway...');
            }
            
            resolve(true);
        });
    });
}

/**
 * Check if manual intervention is needed
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} True if manual intervention is needed
 */
export async function checkForManualIntervention(page) {
    try {
        // First check the page title and URL for obvious blocks
        const title = await page.title().catch(() => '');
        const url = page.url();
        
        console.log(`🔍 Checking page: ${url}`);
        console.log(`📄 Page title: "${title}"`);
        
        // Check for obvious blocking indicators in title
        const blockingTitles = [
            'just a moment', 'attention required', 'access denied', 'blocked', 
            '403', 'forbidden', 'error', 'checking your browser', 'please wait',
            'verifying you are human', 'security check', 'captcha', 'bot detection'
        ];
        const titleLower = title.toLowerCase();
        
        for (const blockingTitle of blockingTitles) {
            if (titleLower.includes(blockingTitle)) {
                console.log(`🚨 Blocking detected in title: "${blockingTitle}"`);
                return true;
            }
        }
        
        // Wait a moment for dynamic content to load
        await page.waitForTimeout(3000);
        
        // First, check if we're on a normal page with expected content
        try {
            // Look for signs this is a normal page, not a challenge
            const hasNormalContent = await page.evaluate(() => {
                const body = document.body;
                if (!body) return false;
                
                // Check for typical website elements that indicate normal page
                const hasNavigation = document.querySelector('nav, .nav, .navbar, .navigation') !== null;
                const hasContent = document.querySelector('main, .main, .content, article, section') !== null;
                const hasLinks = document.querySelectorAll('a').length > 3;
                const hasImages = document.querySelectorAll('img').length > 0;
                const hasTextContent = body.innerText.length > 500;
                
                // If we have several normal page indicators, probably not a challenge
                const normalIndicators = [hasNavigation, hasContent, hasLinks, hasImages, hasTextContent];
                const normalCount = normalIndicators.filter(Boolean).length;
                
                return normalCount >= 2; // At least 2 indicators of normal content
            });
            
            if (hasNormalContent) {
                console.log('✅ Page appears to have normal content - likely not a challenge');
                return false;
            }
        } catch (error) {
            console.log('⚠️ Could not check for normal content, continuing with challenge detection');
        }
        
        // Check for challenge indicators - only the most specific ones
        const challengeSelectors = [
            // Only the most specific challenge selectors
            '[data-ray]',
            '.cf-browser-verification',
            '#cf-challenge-stage', 
            '.cf-checking-browser',
            '#cf-please-wait',
            '#cf-spinner-please-wait',
            '.cf-im-under-attack',
            
            // Only very specific challenge indicators
            'div[id*="challenge"]',
            'div[class*="challenge"][style*="display"]', // Only visible challenge divs
        ];

        for (const selector of challengeSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const isVisible = await element.isVisible().catch(() => false);
                    if (isVisible) {
                        const text = await element.textContent().catch(() => '');
                        console.log(`🔍 Detected challenge element: ${selector} - "${text?.substring(0, 100)}"`);
                        return true;
                    }
                }
            } catch (error) {
                // Continue checking other selectors
            }
        }

        // Check page content for challenge patterns - but be more selective
        const pageText = await page.evaluate(() => {
            return document.body ? document.body.innerText.toLowerCase() : '';
        }).catch(() => '');

        // Only check for very specific challenge patterns and ensure they're prominent
        const challengePatterns = [
            'just a moment', 'checking your browser', 'verifying you are human', 
            'this process is automatic', 'ddos protection'
        ];

        // Only trigger if the pattern appears early in the page (first 1000 chars)
        const prominentPageText = pageText.substring(0, 1000);
        
        for (const pattern of challengePatterns) {
            if (prominentPageText.includes(pattern)) {
                // Double-check: make sure this isn't just mentioned in passing
                const patternCount = (pageText.match(new RegExp(pattern, 'g')) || []).length;
                if (patternCount >= 1 && prominentPageText.includes(pattern)) {
                    console.log(`🔍 Challenge pattern detected prominently: "${pattern}"`);
                    return true;
                }
            }
        }

        // Check if page seems to be loading/redirecting
        const isLoading = await page.evaluate(() => {
            // Check for common loading indicators
            return document.readyState !== 'complete' || 
                   document.querySelector('meta[http-equiv="refresh"]') !== null ||
                   window.location.href.includes('challenge') ||
                   window.location.href.includes('security');
        }).catch(() => false);

        if (isLoading) {
            console.log('🔍 Page appears to be loading or redirecting');
            return true;
        }

        console.log('✅ No challenge detected');
        return false;
    } catch (error) {
        console.log('⚠️ Error checking for manual intervention:', error.message);
        // If we can't check, assume intervention might be needed
        return true;
    }
}

/**
 * Pause execution and let user interact with the browser
 * @param {Page} page - Playwright page  
 * @param {number} seconds - Seconds to pause (0 = wait for user input)
 */
export async function pauseForManualInteraction(page, seconds = 0) {
    if (seconds > 0) {
        console.log(`⏸️ Pausing for ${seconds} seconds for manual interaction...`);
        await page.waitForTimeout(seconds * 1000);
    } else {
        console.log('⏸️ Pausing indefinitely for manual interaction...');
        console.log('👆 Interact with the browser window as needed');
        
        return new Promise(async (resolve) => {
            const { createInterface } = await import('readline');
            const rl = createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question('✅ Press ENTER to continue crawling...', () => {
                rl.close();
                resolve();
            });
        });
    }
}

/**
 * Check if page has successfully loaded normal content (not a challenge page)
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} True if page appears to have normal content
 */
export async function checkForSuccessfulPageLoad(page) {
    try {
        // Wait for page to stabilize
        await page.waitForTimeout(3000);
        
        const pageInfo = await page.evaluate(() => {
            const body = document.body;
            if (!body) return { success: false, reason: 'No body element' };
            
            // Check for typical website elements
            const hasNavigation = document.querySelector('nav, .nav, .navbar, .navigation, header') !== null;
            const hasContent = document.querySelector('main, .main, .content, article, section') !== null;
            const hasLinks = document.querySelectorAll('a').length > 5;
            const hasImages = document.querySelectorAll('img').length > 0;
            const hasTextContent = body.innerText.length > 300;
            const hasForms = document.querySelectorAll('form, input, button').length > 0;
            
            // Check for challenge indicators
            const hasChallengeElements = document.querySelector('[data-ray], .cf-browser-verification, #cf-challenge-stage, .cf-checking-browser') !== null;
            const bodyText = body.innerText.toLowerCase();
            const hasChallengeText = bodyText.includes('just a moment') || 
                                   bodyText.includes('checking your browser') || 
                                   bodyText.includes('verifying you are human');
            
            // Count positive indicators
            const positiveIndicators = [hasNavigation, hasContent, hasLinks, hasImages, hasTextContent, hasForms];
            const positiveCount = positiveIndicators.filter(Boolean).length;
            
            // Determine if this looks like a successful page load
            const success = positiveCount >= 3 && !hasChallengeElements && !hasChallengeText;
            
            return {
                success,
                positiveCount,
                hasNavigation,
                hasContent,
                hasLinks,
                hasImages,
                hasTextContent,
                hasForms,
                hasChallengeElements,
                hasChallengeText,
                textLength: body.innerText.length,
                title: document.title
            };
        });
        
        console.log(`📊 Page analysis: ${JSON.stringify(pageInfo, null, 2)}`);
        
        if (pageInfo.success) {
            console.log('✅ Page appears to have loaded successfully with normal content');
            return true;
        } else {
            console.log(`❌ Page does not appear to have normal content (positive indicators: ${pageInfo.positiveCount}/6)`);
            return false;
        }
        
    } catch (error) {
        console.log(`⚠️ Error checking page success: ${error.message}`);
        return false;
    }
}

/**
 * Debug page state for troubleshooting challenge issues
 * @param {Page} page - Playwright page
 * @param {string} context - Context for debugging
 */
export async function debugPageState(page, context = 'Debug') {
    try {
        console.log(`\n🔍 ${context} - Page State Analysis:`);
        
        const debugInfo = await page.evaluate(() => {
            const body = document.body;
            return {
                url: window.location.href,
                title: document.title,
                readyState: document.readyState,
                bodyExists: !!body,
                bodyText: body ? body.innerText.substring(0, 500) : 'No body',
                bodyClasses: body ? body.className : 'No body',
                metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
                    name: meta.name,
                    content: meta.content,
                    httpEquiv: meta.httpEquiv
                })),
                scripts: Array.from(document.querySelectorAll('script')).length,
                challengeElements: {
                    dataRay: !!document.querySelector('[data-ray]'),
                    cfWrapper: !!document.querySelector('.cf-wrapper'),
                    cfChallenge: !!document.querySelector('#cf-challenge-stage'),
                    cfBrowserVerification: !!document.querySelector('.cf-browser-verification'),
                    cfChecking: !!document.querySelector('.cf-checking-browser')
                },
                pageElements: {
                    links: document.querySelectorAll('a').length,
                    images: document.querySelectorAll('img').length,
                    forms: document.querySelectorAll('form').length,
                    buttons: document.querySelectorAll('button').length,
                    inputs: document.querySelectorAll('input').length
                }
            };
        });
        
        console.log(`📍 URL: ${debugInfo.url}`);
        console.log(`📄 Title: "${debugInfo.title}"`);
        console.log(`⚡ Ready State: ${debugInfo.readyState}`);
        console.log(`🔍 Body Classes: ${debugInfo.bodyClasses}`);
        console.log(`🛡️ Challenge Elements:`, debugInfo.challengeElements);
        console.log(`📊 Page Elements:`, debugInfo.pageElements);
        console.log(`📝 Body Text Preview: "${debugInfo.bodyText}"`);
        
        // Check for refresh meta tags
        const refreshMeta = debugInfo.metaTags.find(meta => 
            meta.httpEquiv && meta.httpEquiv.toLowerCase() === 'refresh'
        );
        if (refreshMeta) {
            console.log(`🔄 Auto-refresh detected: ${refreshMeta.content}`);
        }
        
        // Host-specific analysis
        const hostname = new URL(debugInfo.url).hostname;
        if (hostname.includes('sgpbusiness.com')) {
            console.log('\n🎯 SGP BUSINESS ANALYSIS:');
            const hasChallenge = Object.values(debugInfo.challengeElements).some(Boolean);
            const hasContent = debugInfo.pageElements.links > 5 && debugInfo.bodyText.length > 200;
            
            if (hasChallenge) {
                console.log('❌ Still showing challenge elements');
            } else if (hasContent) {
                console.log('✅ Appears to have normal page content');
            } else {
                console.log('⚠️ Page state unclear - may need more time or manual navigation');
            }
        }
        
        return debugInfo;
    } catch (error) {
        console.log(`❌ Debug failed: ${error.message}`);
        return null;
    }
}

/**
 * Check if page is showing a white/blank page and try to recover
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} True if page recovered, false if still blank
 */
export async function handleWhitePage(page) {
    try {
        console.log('🔍 Checking for white page issue...');
        
        const pageInfo = await page.evaluate(() => {
            const body = document.body;
            const html = document.documentElement;
            
            return {
                hasBody: !!body,
                hasHtml: !!html,
                bodyText: body ? body.innerText.trim() : '',
                bodyHTML: body ? body.innerHTML.length : 0,
                title: document.title,
                url: window.location.href,
                readyState: document.readyState,
                bodyStyle: body ? window.getComputedStyle(body).display : 'none',
                htmlStyle: html ? window.getComputedStyle(html).display : 'none'
            };
        });
        
        console.log(`📊 Page info: ${JSON.stringify(pageInfo, null, 2)}`);
        
        // Check if page is essentially blank
        const isBlankPage = !pageInfo.hasBody || 
                           pageInfo.bodyText.length < 10 || 
                           pageInfo.bodyHTML < 50 ||
                           pageInfo.bodyStyle === 'none';
        
        if (isBlankPage) {
            console.log('⚠️ Detected white/blank page - attempting recovery...');
            
            // Try multiple recovery strategies
            const recoveryStrategies = [
                async () => {
                    console.log('🔄 Strategy 1: Waiting for content to load...');
                    await page.waitForTimeout(10000);
                },
                async () => {
                    console.log('🔄 Strategy 2: Refreshing page...');
                    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
                },
                async () => {
                    console.log('🔄 Strategy 3: Re-navigating to URL...');
                    await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 30000 });
                }
            ];
            
            for (let i = 0; i < recoveryStrategies.length; i++) {
                try {
                    await recoveryStrategies[i]();
                    
                    // Check if recovery worked
                    const newPageInfo = await page.evaluate(() => {
                        const body = document.body;
                        return {
                            hasContent: body && body.innerText.trim().length > 10,
                            bodyHTML: body ? body.innerHTML.length : 0
                        };
                    });
                    
                    if (newPageInfo.hasContent && newPageInfo.bodyHTML > 50) {
                        console.log(`✅ Recovery strategy ${i + 1} successful!`);
                        return true;
                    }
                    
                } catch (error) {
                    console.log(`❌ Recovery strategy ${i + 1} failed: ${error.message}`);
                }
            }
            
            console.log('❌ All recovery strategies failed - manual intervention needed');
            return false;
        }
        
        console.log('✅ Page appears to have content');
        return true;
        
    } catch (error) {
        console.log(`❌ Error checking for white page: ${error.message}`);
        return false;
    }
}

/**
 * Check if we're stuck in a challenge loop
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} True if likely in a challenge loop
 */
export async function checkForChallengeLoop(page) {
    try {
        const pageInfo = await page.evaluate(() => {
            const body = document.body;
            if (!body) return null;
            
            const bodyText = body.innerText.toLowerCase();
            
            // Look for signs of challenge loop
            const challengeIndicators = [
                'checking your browser',
                'just a moment',
                'verifying you are human',
                'ddos protection',
                'please wait'
            ];
            
            const hasMultipleChallengeTexts = challengeIndicators.filter(indicator => 
                bodyText.includes(indicator)
            ).length > 1;
            
            // Check for refresh meta tags (common in loops)
            const refreshMeta = document.querySelector('meta[http-equiv="refresh"]');
            const hasRefresh = !!refreshMeta;
            
            // Check if page title suggests challenge
            const titleSuggestsChallenge = document.title.toLowerCase().includes('just a moment') ||
                                          document.title.toLowerCase().includes('checking');
            
            return {
                hasMultipleChallengeTexts,
                hasRefresh,
                titleSuggestsChallenge,
                bodyLength: bodyText.length,
                title: document.title,
                refreshContent: refreshMeta ? refreshMeta.content : null
            };
        });
        
        if (!pageInfo) return false;
        
        // Determine if we're likely in a loop
        const loopIndicators = [
            pageInfo.hasMultipleChallengeTexts,
            pageInfo.hasRefresh,
            pageInfo.titleSuggestsChallenge && pageInfo.bodyLength < 500
        ];
        
        const loopScore = loopIndicators.filter(Boolean).length;
        const isInLoop = loopScore >= 2;
        
        if (isInLoop) {
            console.log('🔄 Challenge loop detection:');
            console.log(`  • Multiple challenge texts: ${pageInfo.hasMultipleChallengeTexts}`);
            console.log(`  • Has refresh meta: ${pageInfo.hasRefresh}`);
            console.log(`  • Title suggests challenge: ${pageInfo.titleSuggestsChallenge}`);
            console.log(`  • Body length: ${pageInfo.bodyLength}`);
            if (pageInfo.refreshContent) {
                console.log(`  • Refresh content: ${pageInfo.refreshContent}`);
            }
        }
        
        return isInLoop;
        
    } catch (error) {
        console.log(`⚠️ Error checking for challenge loop: ${error.message}`);
        return false;
    }
}
