/**
 * Fetches HTML using Puppeteer (headless browser)
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} - The page HTML
 */
const { fetchHTML, fetchHTMLWithBrowser } = require('./fetchHtmlUtil');
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
        setTimeout(() => reject(new Error('Metadata fetch timeout - taking too long')), 30000)
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
        authors: ['Unknown Author'],
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
            fallback.authors = [authorMatch[1]];

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

module.exports = {
    fetchFicMetadata,
    quickLinkCheck
};