// ao3BrowserManager.js
// Handles shared Puppeteer browser instance, logging, and resource monitoring for AO3 utilities.

import puppeteer from 'puppeteer';

let sharedBrowser = null;
let sharedBrowserUseCount = 0;
let resetMutex = Promise.resolve();

export async function resetSharedBrowser() {
    let release;
    const lock = new Promise(res => { release = res; });
    const prev = resetMutex;
    resetMutex = prev.then(() => lock);
    await prev;
    try {
        if (sharedBrowser && sharedBrowser.isConnected()) {
            await sharedBrowser.close().catch(() => {});
        }
        sharedBrowser = null;
        sharedBrowserUseCount = 0;
        currentUserAgent = userAgent;
        logBrowserEvent('Shared browser has been reset.');
    } finally {
        release();
    }
}
export const SHARED_BROWSER_MAX_USES = 25;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0';
let currentUserAgent = userAgent;

export function logBrowserEvent(msg) {
    const now = new Date().toISOString();
    console.log(`[AO3][Browser] ${now} ${msg}`);
}

export async function getSharedBrowser() {
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
        currentUserAgent = userAgent;
        logBrowserEvent('Browser launched. User-Agent (fixed): ' + currentUserAgent);
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

export function getCurrentUserAgent() {
    return currentUserAgent;
}
