/**
 * Fetches HTML using Puppeteer (headless browser)
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} - The page HTML
 */
async function fetchHTMLWithBrowser(url) {
    // Generic browser-based HTML fetch
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1'
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const html = await page.content();
    await browser.close();
    return html;
}
const https = require('https');
const http = require('http');
const { fetchAO3MetadataWithFallback, parseAO3Metadata, detectAO3LinksInHtml } = require('./ao3Meta');
const { fetchFFNetMetadata } = require('./ffnMeta');
const { fetchWattpadMetadata } = require('./wattpadMeta');
const { fetchLiveJournalMetadata } = require('./ljMeta');
const { fetchDreamwidthMetadata } = require('./dwMeta');
const normalizeMetadata = require('./normalizeMetadata');
const quickLinkCheck = require('./quickLinkCheck');

/**
 * Fetches fanfiction metadata from supported sites
 * @param {string} url - The fanfiction URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object|null>} - Metadata object or null if failed
 */
async function fetchFicMetadata(url, includeRawHtml = false) {
    // Add overall timeout to prevent Discord interaction expiry
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Metadata fetch timeout - taking too long')), 10000)
    );

    const fetchPromise = async () => {
        try {
            let metadata = null;
            let source = null;

            if (url.includes('archiveofourown.org')) {
                metadata = await fetchAO3MetadataWithFallback(url, includeRawHtml);
                if (metadata) source = 'ao3';
            } else if (url.includes('fanfiction.net')) {
                metadata = await fetchFFNetMetadata(url, includeRawHtml);
                source = 'ffnet';
            } else if (url.includes('wattpad.com')) {
                metadata = await fetchWattpadMetadata(url, includeRawHtml);
                source = 'wattpad';
            } else if (url.includes('livejournal.com') || url.includes('.livejournal.com')) {
                metadata = await fetchLiveJournalMetadata(url, includeRawHtml);
                source = 'livejournal';
            } else if (url.includes('dreamwidth.org') || url.includes('.dreamwidth.org')) {
                metadata = await fetchDreamwidthMetadata(url, includeRawHtml);
                source = 'dreamwidth';
            } else if (url.includes('tumblr.com') || url.includes('.tumblr.com')) {
                metadata = await fetchTumblrMetadata(url, includeRawHtml);
                source = 'tumblr';
            }

            if (metadata && source) {
                return normalizeMetadata(metadata, source);
            }

            return metadata;
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return null;
        }
    };
async function fetchAO3MetadataFromHtml(html, url, includeRawHtml = false) {
    // For legacy compatibility, use the parser directly
    return parseAO3Metadata(html, url, includeRawHtml);
}
    try {
        return await Promise.race([fetchPromise(), timeoutPromise]);
    } catch (error) {
        console.error('Metadata fetch failed or timed out:', error.message);
        return null;
    }
}

/**
 * Creates fallback metadata when parsing fails
 */
function createFallbackMetadata(url, source, errorMessage) {
    const platformName = source.charAt(0).toUpperCase() + source.slice(1);
    const fallback = {
        url: url,
        title: `${platformName} Story`,
        author: 'Unknown Author',
        summary: `This story is hosted on ${platformName}. ${errorMessage}. You might want to manually add the story details using the manual fields.`,
        chapters: '1',
        status: 'Unknown',
        rating: 'Not Rated',
        language: 'English',
        error: errorMessage,
        requiresManualEntry: true
    };

    // Special handling for Tumblr - try to extract author and detect reblogs even in fallback
    if (source === 'tumblr') {
        const authorMatch = url.match(/https?:\/\/([^.]+)\.tumblr\.com/);
        if (authorMatch) {
            fallback.author = authorMatch[1];

            // Simple reblog detection based on URL patterns
            const urlReblogPattern = /\/post\/\d+\/.+/;
            if (urlReblogPattern.test(url)) {
                fallback.isReblog = true;
                fallback.rebloggedBy = authorMatch[1];
                fallback.reblogWarning = `⚠️ This appears to be a reblog by ${authorMatch[1]}. The original author may be different. Please manually enter the correct author name.`;
                fallback.summary = `This story is hosted on Tumblr. ${errorMessage}. ⚠️ This may be a reblog - please check the original author and manually add the correct story details.`;
            }
        }
    }
    return fallback;
}

/**
 * Fetches HTML content from a URL
 */
function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        // Always append ?view_adult=true for AO3 URLs
        let urlToFetch = url;
        if (urlToFetch.includes('archiveofourown.org') && !urlToFetch.includes('view_adult=true')) {
            urlToFetch += (urlToFetch.includes('?') ? '&' : '?') + 'view_adult=true';
        }
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        };

        https.get(urlToFetch, options, (res) => {
            // Check for HTTP error status codes
            if (res.statusCode === 404) {
                reject(new Error('HTTP_404_NOT_FOUND'));
                return;
            } else if (res.statusCode === 403) {
                reject(new Error('HTTP_403_FORBIDDEN'));
                return;
            } else if (res.statusCode === 500) {
                reject(new Error('HTTP_500_SERVER_ERROR'));
                return;
            } else if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
                reject(new Error(`HTTP_${res.statusCode}_ERROR`));
                return;
            }

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = {
    fetchFicMetadata,
    quickLinkCheck,
    fetchHTML,
    fetchHTMLWithBrowser
};