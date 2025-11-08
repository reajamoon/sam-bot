/**
 * LiveJournal metadata fetcher and parser
 * @module ljMeta
 */
const { fetchHTML } = require('./fetchHtmlUtil');

/**
 * Fetches metadata from LiveJournal
 * @param {string} url - The post URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object|null>} - Metadata object or null if failed
 */
async function fetchLiveJournalMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) {
            return createFallbackMetadata(url, 'livejournal', 'Could not fetch content from LiveJournal');
        }

        const metadata = { url: url };

        // LiveJournal titles can be in various formats
        let titleMatch = html.match(/<title>([^<]+)/);
        if (titleMatch) {
            metadata.title = titleMatch[1].replace(/\s*-\s*[^-]*LiveJournal/, '').trim();
        } else {
            metadata.title = 'LiveJournal Post';
        }

        // Author - look for journal username
        let authorMatch = url.match(/https?:\/\/([^.]+)\.livejournal\.com/);
        if (!authorMatch) {
            authorMatch = html.match(/<span[^>]*class="[^"]*ljuser[^"]*"[^>]*>([^<]+)/);
        }
        if (!authorMatch) {
            authorMatch = html.match(/journal[:\s]+([^<\s,]+)/i);
        }
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        // Content/Summary - LiveJournal posts use various content divs
        let summaryMatch = html.match(/<div[^>]*class="[^"]*entry[^"]*"[^>]*>(.*?)<\/div>/s);
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*id="[^"]*entry[^"]*"[^>]*>(.*?)<\/div>/s);
        }
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*class="[^"]*asset-body[^"]*"[^>]*>(.*?)<\/div>/s);
        }

        if (summaryMatch) {
            const cleanContent = summaryMatch[1]
                .replace(/<script[^>]*>.*?<\/script>/gs, '')
                .replace(/<style[^>]*>.*?<\/style>/gs, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            metadata.summary = cleanContent.length > 300
                ? cleanContent.substring(0, 300) + '...'
                : cleanContent;
        }

        // Tags - LiveJournal uses various tag patterns
        const tagMatches = html.match(/<div[^>]*class="[^"]*ljtags[^"]*"[^>]*>(.*?)<\/div>/s);
        if (tagMatches) {
            const tagRegex = /<a[^>]*>([^<]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Date - look for posting date
        let dateMatch = html.match(/<span[^>]*class="[^"]*datetime[^"]*"[^>]*>([^<]+)/);
        if (!dateMatch) {
            dateMatch = html.match(/(\w+\s+\d{1,2},?\s+\d{4})/);
        }
        if (dateMatch) {
            try {
                metadata.publishedDate = new Date(dateMatch[1]).toISOString().split('T')[0];
            } catch (e) {
                // Date parsing failed, that's okay
            }
        }

        // Default values for LiveJournal
        metadata.chapters = '1';
        metadata.status = 'Complete';
        metadata.rating = 'Not Rated';
        metadata.language = 'English';

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        // Handle HTTP errors from fetchHTML
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Post Not Found',
                author: 'Unknown Author',
                url: url,
                error: '404_not_found',
                summary: 'This LiveJournal post appears to have been deleted or moved. The link is no longer working.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This LiveJournal post is private or restricted. You might need to be logged in or have special permissions to view it.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this LiveJournal post. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }

        console.error('Error parsing LiveJournal metadata:', error);
        return createFallbackMetadata(url, 'livejournal', 'Could not parse LiveJournal content');
    }
}

module.exports = {
    fetchLiveJournalMetadata
};
