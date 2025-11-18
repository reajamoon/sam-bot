// ao3BrowserManager.js
// Handles shared Puppeteer browser instance, logging, and resource monitoring for AO3 utilities.

const puppeteer = require('puppeteer');


let sharedBrowser = null;
let sharedBrowserUseCount = 0;
const SHARED_BROWSER_MAX_USES = 25; // Restart browser after this many uses

const fs = require('fs');
const path = require('path');
// User-agent pool for randomization
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.198 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];
let currentUserAgent = null;
const COOKIES_META_PATH = path.join(process.cwd(), 'ao3_cookies_meta.json');

function logBrowserEvent(msg) {
    const now = new Date().toISOString();
    console.log(`[AO3][Browser] ${now} ${msg}`);
}

async function getSharedBrowser() {
    if (
        sharedBrowser &&
        sharedBrowser.process() &&
        sharedBrowser.isConnected() &&
        sharedBrowserUseCount < SHARED_BROWSER_MAX_USES
    ) {
        sharedBrowserUseCount++;
        return sharedBrowser;
    }
    if (sharedBrowser) {
        logBrowserEvent('Restarting browser due to use threshold or error.');
        try { if (sharedBrowser && sharedBrowser.isConnected()) await sharedBrowser.close(); logBrowserEvent('Browser closed.'); } catch (err) { logBrowserEvent('Error closing browser: ' + err.message); }
    }
    try {
        sharedBrowser = await puppeteer.launch({
            headless: process.env.AO3_HEADLESS === 'false' ? false : true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        sharedBrowserUseCount = 1;
        // Try to load user-agent from meta file if it exists
        if (fs.existsSync(COOKIES_META_PATH)) {
            try {
                const meta = JSON.parse(fs.readFileSync(COOKIES_META_PATH, 'utf8'));
                if (meta && meta.userAgent && userAgents.includes(meta.userAgent)) {
                    currentUserAgent = meta.userAgent;
                    logBrowserEvent('Browser launched. User-Agent (from meta): ' + currentUserAgent);
                } else {
                    currentUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                    logBrowserEvent('Browser launched. User-Agent (random): ' + currentUserAgent);
                }
            } catch (err) {
                currentUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                logBrowserEvent('Browser launched. User-Agent (random, meta load failed): ' + currentUserAgent);
            }
        } else {
            currentUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
            logBrowserEvent('Browser launched. User-Agent (random, no meta): ' + currentUserAgent);
        }
        sharedBrowser.on('disconnected', () => {
            logBrowserEvent('Browser disconnected! Will restart on next use.');
            sharedBrowser = null;
            sharedBrowserUseCount = 0;
            currentUserAgent = null;
        });
        return sharedBrowser;
    } catch (err) {
        logBrowserEvent('Error launching browser: ' + err.message);
        throw err;
    }
}
// Utility to save user-agent to meta file (call this when saving cookies)
function saveUserAgentMeta(userAgent) {
    try {
        fs.writeFileSync(COOKIES_META_PATH, JSON.stringify({ userAgent }), 'utf8');
        logBrowserEvent('Saved user-agent to meta file: ' + userAgent);
    } catch (err) {
        logBrowserEvent('Failed to save user-agent meta: ' + err.message);
    }
}

function setupBrowserShutdown() {
    const shutdown = async () => {
        if (sharedBrowser) {
            logBrowserEvent('Shutting down browser due to process exit.');
            try { if (sharedBrowser && sharedBrowser.isConnected()) await sharedBrowser.close(); logBrowserEvent('Browser closed.'); } catch (err) { logBrowserEvent('Error closing browser: ' + err.message); }
        }
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
setupBrowserShutdown();
// Periodically log open pages and perform a health check (every 10 minutes)
setInterval(async () => {
    if (sharedBrowser && sharedBrowser.isConnected()) {
        try {
            const pages = await sharedBrowser.pages();
            logBrowserEvent(`Open pages: ${pages.length}`);
        } catch (err) {
            logBrowserEvent('Error checking open pages: ' + err.message);
        }
        // Health check: try to create and close a blank page
        try {
            const testPage = await sharedBrowser.newPage();
            try { await testPage.close(); } catch (e) { logBrowserEvent('Error closing test page during health check: ' + e.message); }
            logBrowserEvent('Health check: browser is healthy.');
        } catch (err) {
            logBrowserEvent('Health check failed, restarting browser: ' + err.message);
            try { if (sharedBrowser && sharedBrowser.isConnected()) await sharedBrowser.close(); logBrowserEvent('Browser closed after failed health check.'); } catch (closeErr) { logBrowserEvent('Error closing browser after health check: ' + closeErr.message); }
            sharedBrowser = null;
            sharedBrowserUseCount = 0;
        }
    }
}, 10 * 60 * 1000);

function getCurrentUserAgent() {
    return currentUserAgent || userAgents[0];
}

module.exports = {
    getSharedBrowser,
    logBrowserEvent,
    getCurrentUserAgent,
    saveUserAgentMeta
};
