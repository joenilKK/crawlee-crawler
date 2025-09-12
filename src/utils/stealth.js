/**
 * Advanced stealth utilities for bypassing bot detection and browser fingerprinting
 */

/**
 * Generate a realistic viewport size based on common screen resolutions
 */
export function getRandomViewport() {
    const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 1600, height: 900 },
        { width: 1024, height: 768 }
    ];
    
    return viewports[Math.floor(Math.random() * viewports.length)];
}

/**
 * Generate realistic HTTP headers for a given user agent
 */
export function getRealisticHeaders(userAgent) {
    const isChrome = userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    
    const baseHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': userAgent
    };
    
    if (isChrome) {
        return {
            ...baseHeaders,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };
    } else if (isFirefox) {
        return {
            ...baseHeaders,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        };
    } else if (isSafari) {
        return {
            ...baseHeaders,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br'
        };
    }
    
    return baseHeaders;
}

/**
 * Generate a realistic timezone offset (Singapore timezone)
 */
export function getTimezoneOffset() {
    return -480; // UTC+8 (Singapore timezone)
}

/**
 * Generate realistic hardware information
 */
export function getHardwareInfo() {
    const hardwareConfigs = [
        { cores: 4, memory: 8, platform: 'Win32' },
        { cores: 8, memory: 16, platform: 'Win32' },
        { cores: 6, memory: 12, platform: 'Win32' },
        { cores: 4, memory: 8, platform: 'MacIntel' },
        { cores: 8, memory: 16, platform: 'MacIntel' }
    ];
    
    return hardwareConfigs[Math.floor(Math.random() * hardwareConfigs.length)];
}

/**
 * Generate realistic screen properties
 */
export function getScreenProperties(viewport) {
    return {
        availTop: 0,
        availLeft: 0,
        availWidth: viewport.width,
        availHeight: viewport.height - 40, // Account for taskbar
        colorDepth: 24,
        pixelDepth: 24,
        width: viewport.width,
        height: viewport.height
    };
}

/**
 * Generate realistic network connection info
 */
export function getConnectionInfo() {
    const connectionTypes = [
        { effectiveType: '4g', rtt: 50, downlink: 10, saveData: false },
        { effectiveType: '3g', rtt: 150, downlink: 1.5, saveData: false },
        { effectiveType: '4g', rtt: 100, downlink: 5, saveData: false }
    ];
    
    return connectionTypes[Math.floor(Math.random() * connectionTypes.length)];
}

/**
 * Generate realistic battery information
 */
export function getBatteryInfo() {
    return {
        charging: Math.random() > 0.3, // 70% chance of charging
        chargingTime: Math.random() > 0.5 ? Infinity : Math.floor(Math.random() * 3600),
        dischargingTime: Math.random() > 0.5 ? Infinity : Math.floor(Math.random() * 7200),
        level: Math.random() * 0.4 + 0.6 // 60-100% battery
    };
}

/**
 * Generate realistic WebGL vendor and renderer
 */
export function getWebGLInfo() {
    const gpuConfigs = [
        { vendor: 'Intel Inc.', renderer: 'Intel(R) HD Graphics 620' },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1060' },
        { vendor: 'AMD', renderer: 'AMD Radeon RX 580' },
        { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630' }
    ];
    
    return gpuConfigs[Math.floor(Math.random() * gpuConfigs.length)];
}

/**
 * Generate realistic media devices
 */
export function getMediaDevices() {
    return [
        { deviceId: 'default', kind: 'audioinput', label: 'Default - Microphone', groupId: 'group1' },
        { deviceId: 'default', kind: 'audiooutput', label: 'Default - Speaker', groupId: 'group1' },
        { deviceId: 'camera1', kind: 'videoinput', label: 'Integrated Camera', groupId: 'group2' }
    ];
}

/**
 * Generate realistic Chrome load times
 */
export function getChromeLoadTimes() {
    const now = Date.now() / 1000;
    const randomOffset = Math.random() * 5;
    
    return {
        requestTime: now - randomOffset - Math.random() * 10,
        startLoadTime: now - randomOffset - Math.random() * 5,
        commitLoadTime: now - randomOffset - Math.random() * 3,
        finishDocumentLoadTime: now - randomOffset - Math.random() * 2,
        finishLoadTime: now - randomOffset - Math.random() * 1,
        firstPaintTime: now - randomOffset - Math.random() * 0.5,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other'
    };
}

/**
 * Generate realistic Chrome CSI data
 */
export function getChromeCSI() {
    const now = Date.now();
    return {
        pageT: now - Math.random() * 1000,
        startE: now - Math.random() * 500,
        tran: 15
    };
}

/**
 * Add random jitter to timing values to avoid detection
 */
export function addTimingJitter(value, jitterPercent = 0.1) {
    const jitter = value * jitterPercent * (Math.random() - 0.5) * 2;
    return value + jitter;
}

/**
 * Generate realistic mouse movement path
 */
export function generateMousePath(startX, startY, endX, endY, steps = 5) {
    const path = [];
    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const x = startX + (endX - startX) * progress + (Math.random() - 0.5) * 10;
        const y = startY + (endY - startY) * progress + (Math.random() - 0.5) * 10;
        path.push({ x, y });
    }
    return path;
}

/**
 * Simulate realistic typing speed and patterns
 */
export function getTypingDelay() {
    // Human typing speed varies between 50-200ms per character
    return Math.random() * 150 + 50;
}

/**
 * Generate realistic scroll behavior
 */
export function getScrollBehavior() {
    return {
        smooth: Math.random() > 0.3, // 70% chance of smooth scrolling
        duration: Math.random() * 500 + 200, // 200-700ms scroll duration
        distance: Math.random() * 300 + 100 // 100-400px scroll distance
    };
}
