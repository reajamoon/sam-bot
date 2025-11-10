/**
 * FanFiction.Net metadata fetcher and parser
 * @module FFNetMeta
 */
const { fetchHTML } = require('./fetchHtmlUtil');
const normalizeMetadata = require('./normalizeMetadata');

/**
 * Fetches metadata from FanFiction.Net
 * @param {string} url - The story URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object|null>} - Metadata object or null if failed
 */
async function fetchFFNetMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) return null;

        console.log('FFNet HTML length:', html.length);

        // Check for Cloudflare or other protection
        if (html.includes('challenge') || html.includes('cloudflare') || html.includes('Enable JavaScript')) {
            console.log('Cloudflare protection detected on FFNet');
            const result = {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: 'Yeah, so this site has some serious security measures that are blocking me from reading the story details. Think of it like warding - keeps the bad stuff out, but also keeps me from doing my job.'
            };
            if (includeRawHtml) result.rawHtml = html.substring(0, 500) + '...';
            return result;
        }
    } catch (error) {
        // Handle HTTP errors
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Story Not Found',
                authors: ['Unknown Author'],
                url: url,
                error: '404_not_found',
                summary: 'This story appears to have been deleted or moved. The link is no longer working. You might want to check if the author has reposted it elsewhere.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                authors: ['Unknown Author'],
                url: url,
                error: 'Access denied',
                summary: 'This story is restricted or requires special permissions to access. It might be locked to registered users only.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                authors: ['Unknown Author'],
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this story. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }

        console.error('Error fetching FFNet metadata:', error);
        return null;
    }

    try {
        const metadata = { url: url };

        // Multiple patterns for title - FFNet has changed their HTML structure over time
        let titleMatch = html.match(/<b class='xcontrast_txt'>([^<]+)/);
        if (!titleMatch) {
            titleMatch = html.match(/<title>([^|]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace('Chapter 1:', '').trim();
            }
        } else {
            metadata.title = titleMatch[1].trim();
        }

        if (!metadata.title) {
            metadata.title = 'Unknown Title';
        }

        console.log('FFNet parsed title:', metadata.title);

        // Multiple patterns for author
        let authorMatch = html.match(/<a class='xcontrast_txt' href='\/u\/\d+\/[^']*'>([^<]+)/);
        if (!authorMatch) {
            authorMatch = html.match(/By:\s*<a[^>]*>([^<]+)/i);
        }
        metadata.authors = [authorMatch ? authorMatch[1].trim() : 'Unknown Author'];

        console.log('FFNet parsed authors:', metadata.authors);

        // Summary - multiple patterns
        let summaryMatch = html.match(/<div class='xcontrast_txt' style='margin-top:2px'>([^<]+)/);
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*class="[^"]*storytext[^"]*"[^>]*>(.*?)<\/div>/s);
            if (summaryMatch) {
                metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 500);
            }
        } else {
            metadata.summary = summaryMatch[1].trim();
        }

        console.log('FFNet parsed summary:', metadata.summary?.substring(0, 100));

        // Try to find metadata in various formats
        const metaPatterns = [
            /<span class='xgray xcontrast_txt'>([^<]+)/,
            /<span[^>]*class="[^"]*xgray[^"]*"[^>]*>([^<]+)/,
            /<div[^>]*id="profile_top"[^>]*>(.*?)<\/div>/s
        ];

        let metaText = '';
        for (const pattern of metaPatterns) {
            const match = html.match(pattern);
            if (match) {
                metaText = match[1];
                break;
            }
        }

        console.log('FFNet metadata text:', metaText.substring(0, 200));

        if (metaText) {
            // Look for rating
            const ratingMatch = metaText.match(/Rated:\s*([^\-\s]+)/i);
            metadata.rating = ratingMatch ? ratingMatch[1].trim() : 'Not Rated';

            // Look for language
            const languageMatch = metaText.match(/(?:English|Spanish|French|German|Italian|Portuguese|Russian)\b/i);
            metadata.language = languageMatch ? languageMatch[0] : 'English';

            // Look for word count
            const wordMatch = metaText.match(/Words:\s*([\d,]+)/i);
            if (wordMatch) {
                metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
            }

            // Look for chapters
            const chapterMatch = metaText.match(/Chapters:\s*(\d+)/i);
            metadata.chapters = chapterMatch ? chapterMatch[1] : '1';

            // Status
            metadata.status = metaText.match(/Complete/i) ? 'Complete' : 'Work in Progress';

            // Look for published/updated dates
            const publishedMatch = metaText.match(/Published:\s*([^-]+)/i);
            if (publishedMatch) {
                try {
                    metadata.publishedDate = new Date(publishedMatch[1].trim()).toISOString().split('T')[0];
                } catch (e) {
                    console.log('Could not parse published date:', publishedMatch[1]);
                }
            }

            const updatedMatch = metaText.match(/Updated:\s*([^-]+)/i);
            if (updatedMatch) {
                try {
                    metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
                } catch (e) {
                    console.log('Could not parse updated date:', updatedMatch[1]);
                }
            }
        }

        console.log('FFNet final metadata:', JSON.stringify(metadata, null, 2));
        if (includeRawHtml) metadata.rawHtml = html;
        // Remove legacy 'author' field if present
        if (metadata.author) delete metadata.author;
        return normalizeMetadata(metadata, 'ffnet');
    } catch (error) {
        console.error('Error parsing FFNet metadata:', error);
        return null;
    }
}

module.exports = {
    fetchFFNetMetadata
};
