// ao3SeriesFetch.js
// Fetches and parses AO3 series metadata

import { getLoggedInAO3Page, bypassStayLoggedInInterstitial } from './ao3Utils.js';
import { parseAO3SeriesMetadata } from './ao3SeriesParser.js';

async function fetchAO3SeriesMetadata(url, includeRawHtml = false) {
    let html, browser, page;
    try {
        const loginResult = await getLoggedInAO3Page(url);
        browser = loginResult.browser;
        page = loginResult.page;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await bypassStayLoggedInInterstitial(page, url);
        html = await page.content();
        if (browser && browser.isConnected()) {
            try { await browser.close(); } catch {}
        }
        const metadata = parseAO3SeriesMetadata(html, url);
        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (err) {
        if (browser && browser.isConnected()) {
            try { await browser.close(); } catch {}
        }
        // Debug: print full error stack to help trace 'fs is not defined'
        console.error('[AO3 SERIES FETCH ERROR]', err && err.stack ? err.stack : err);
        return {
            url,
            type: 'series',
            error: true,
            message: 'Failed to fetch AO3 series metadata',
            details: err && err.message ? err.message : err
        };
    }
}

export { fetchAO3SeriesMetadata };
