const updateMessages = require('../../commands/recHandlers/updateMessages');
/**
 * Wattpad metadata fetcher and parser
 * @module wattpadMeta
 */
const { fetchHTML } = require('./fetchHtmlUtil');
const normalizeMetadata = require('./normalizeMetadata');

/**
 * Fetches metadata from Wattpad
 * @param {string} url - The story URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object|null>} - Metadata object or null if failed
 */
async function fetchWattpadMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) return null;

        const metadata = { url: url };

        // Title - Wattpad uses various patterns
        let titleMatch = html.match(/<h1[^>]*class="[^"]*story-title[^"]*"[^>]*>([^<]+)/);
        if (!titleMatch) {
            titleMatch = html.match(/<title>([^|]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace(' - Wattpad', '').trim();
            }
        } else {
            metadata.title = titleMatch[1].trim();
        }

        if (!metadata.title) {
            metadata.title = 'Unknown Title';
        }

        // Author - look for username patterns
        let authorMatch = html.match(/<a[^>]*href="\/user\/[^"]*"[^>]*>([^<]+)/);
        if (!authorMatch) {
            authorMatch = html.match(/"username":"([^"]+)"/);
        }
        if (!authorMatch) {
            authorMatch = html.match(/by\s+([^<\n]+)/i);
        }
        metadata.authors = authorMatch ? [authorMatch[1].trim()] : ['Unknown Author'];

        // Description/Summary - Wattpad uses description class
        let summaryMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/s);
        if (!summaryMatch) {
            summaryMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
        }
        if (summaryMatch) {
            metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim();
            if (metadata.summary.length > 500) {
                metadata.summary = metadata.summary.substring(0, 500) + '...';
            }
        }

        // Try to extract JSON data that Wattpad embeds
        const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);

                // Extract story data from the JSON
                if (data.story) {
                    metadata.title = data.story.title || metadata.title;
                    metadata.authors = [data.story.user?.username || (metadata.authors && metadata.authors[0]) || 'Unknown Author'];
                    metadata.summary = data.story.description || metadata.summary;

                    if (data.story.numParts) {
                        metadata.chapters = data.story.numParts.toString();
                    }

                    if (data.story.isCompleted !== undefined) {
                        metadata.status = data.story.isCompleted ? 'Complete' : 'Work in Progress';
                    }

                    // Language
                    metadata.language = data.story.language?.name || 'English';

                    // Tags
                    if (data.story.tags && Array.isArray(data.story.tags)) {
                        metadata.tags = data.story.tags.map(tag => tag.name || tag).slice(0, 10);
                    }

                    // Reading time (Wattpad specific)
                    if (data.story.readingTime) {
                        metadata.readingTime = data.story.readingTime;
                    }

                    // Reads and votes (Wattpad metrics)
                    if (data.story.readCount) {
                        metadata.reads = data.story.readCount;
                    }
                    if (data.story.voteCount) {
                        metadata.votes = data.story.voteCount;
                    }
                }
            } catch (e) {
                console.log('Could not parse Wattpad JSON data:', e.message);
            }
        }

        // Fallback patterns for basic info
        if (!metadata.chapters) {
            const chaptersMatch = html.match(/(\d+)\s*parts?/i);
            metadata.chapters = chaptersMatch ? chaptersMatch[1] : '1';
        }

        // Look for reads and votes in the HTML
        if (!metadata.reads) {
            const readsMatch = html.match(/([\d,]+)\s*reads?/i);
            if (readsMatch) {
                metadata.reads = parseInt(readsMatch[1].replace(/,/g, ''));
            }
        }

        if (!metadata.votes) {
            const votesMatch = html.match(/([\d,]+)\s*votes?/i);
            if (votesMatch) {
                metadata.votes = parseInt(votesMatch[1].replace(/,/g, ''));
            }
        }

    // Default values
    metadata.rating = 'Not Rated'; // Wattpad doesn't use traditional ratings
    metadata.language = metadata.language || 'English';
    metadata.status = metadata.status || 'Unknown';
    // Always set archiveWarnings to an array
    if (!Array.isArray(metadata.archiveWarnings)) metadata.archiveWarnings = [];

        if (includeRawHtml) metadata.rawHtml = html;
    // Remove legacy 'author' field if present
    if (metadata.author) delete metadata.author;
    return normalizeMetadata(metadata, 'wattpad');
    } catch (error) {
        // Handle HTTP errors from fetchHTML
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: updateMessages.notFound404,
                authors: ['Unknown Author'],
                url: url,
                error: '404_not_found',
                summary: updateMessages.notFound404,
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: updateMessages.forbidden403,
                authors: ['Unknown Author'],
                url: url,
                error: 'Access denied',
                summary: updateMessages.forbidden403,
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: updateMessages.connectionError,
                authors: ['Unknown Author'],
                url: url,
                error: error.message,
                summary: updateMessages.connectionError,
                isHttpError: true
            };
        }

        console.error('Error parsing Wattpad metadata:', error);
        return null;
    }
}

module.exports = {
    fetchWattpadMetadata
};
