/**
 * Tumblr metadata fetcher and parser
 * @module tumblrMeta
 */
const { fetchHTML } = require('./fetchHtmlUtil');

/**
 * Fetches metadata from Tumblr
 * @param {string} url - The post URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object|null>} - Metadata object or null if failed
 */
async function fetchTumblrMetadata(url, includeRawHtml = false) {
    try {
        let html = await fetchHTML(url);
        if (!html) {
            return createFallbackMetadata(url, 'tumblr', 'Could not fetch content from Tumblr');
        }

        // Check for Tumblr's various protection measures
        if (html.includes('Enable JavaScript') || html.includes('cf-browser-verification')) {
            // Try Puppeteer fallback for JS-required/protected pages
            try {
                const { fetchHTMLWithBrowser } = require('./ficParser');
                const browserHtml = await fetchHTMLWithBrowser(url);
                if (browserHtml && browserHtml.length > 1000 && !browserHtml.includes('Enable JavaScript') && !browserHtml.includes('cf-browser-verification')) {
                    // Use browserHtml for parsing
                    html = browserHtml;
                } else {
                    return createFallbackMetadata(url, 'tumblr', 'Tumblr requires JavaScript or has protection enabled');
                }
            } catch (e) {
                return createFallbackMetadata(url, 'tumblr', 'Tumblr requires JavaScript or has protection enabled');
            }
        }

        const metadata = { url: url };

        // Try to extract from JSON-LD structured data
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        if (jsonLdMatch) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1]);
                if (jsonData.headline) {
                    metadata.title = jsonData.headline;
                }
                if (jsonData.author && jsonData.author.name) {
                    metadata.author = jsonData.author.name;
                }
                if (jsonData.description) {
                    metadata.summary = jsonData.description;
                }
                if (jsonData.datePublished) {
                    metadata.publishedDate = new Date(jsonData.datePublished).toISOString().split('T')[0];
                }
            } catch (e) {
                // JSON parsing failed, continue with HTML parsing
            }
        }

        // Title - try various Tumblr patterns
        if (!metadata.title) {
            let titleMatch = html.match(/<title>([^<]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace(/\s*—\s*Tumblr$/, '').trim();
            } else {
                metadata.title = 'Tumblr Post';
            }
        }

        // Author - extract from URL or blog name
        if (!metadata.author) {
            let authorMatch = url.match(/https?:\/\/([^.]+)\.tumblr\.com/);
            if (!authorMatch) {
                authorMatch = html.match(/<span[^>]*class="[^"]*blog-name[^"]*"[^>]*>([^<]+)/);
            }
            metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';
        }

        // Reblog Detection - check if this is a reblog
        const isReblog = detectTumblrReblog(url, html);
        if (isReblog.isReblog) {
            metadata.isReblog = true;
            metadata.rebloggedBy = metadata.author; // The user from the URL
            metadata.reblogWarning = `⚠️ This appears to be a reblog by ${metadata.author}. The original author may be different. Please check the post content and manually enter the correct author name.`;

            // Try to find original author in content
            if (isReblog.originalAuthor) {
                metadata.suggestedAuthor = isReblog.originalAuthor;
                metadata.reblogWarning += ` Possible original author: ${isReblog.originalAuthor}`;
            }
        }

        // AO3 Link Detection - check if post contains AO3 links
        // You may want to import and use detectAO3LinksInHtml here if needed

        // Content/Summary - Tumblr post content
        if (!metadata.summary) {
            let summaryMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>(.*?)<\/div>/s);
            if (!summaryMatch) {
                summaryMatch = html.match(/<article[^>]*>(.*?)<\/article>/s);
            }
            if (!summaryMatch) {
                summaryMatch = html.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>(.*?)<\/div>/s);
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
        }

        // Tags - Tumblr has tag sections
        const tagMatches = html.match(/<div[^>]*class="[^"]*tags[^"]*"[^>]*>(.*?)<\/div>/s);
        if (tagMatches) {
            const tagRegex = /#([^<\s,]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Notes (Tumblr's equivalent of engagement)
        const notesMatch = html.match(/(\d+)\s*notes?/i);
        if (notesMatch) {
            metadata.notes = parseInt(notesMatch[1]);
        }

        // Default values for Tumblr
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
                summary: 'This Tumblr post appears to have been deleted or the blog was deactivated. The link is no longer working.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This Tumblr post is from a private blog or has restricted access. You might need special permissions to view it.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this Tumblr post. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }

        console.error('Error parsing Tumblr metadata:', error);
        return createFallbackMetadata(url, 'tumblr', 'Could not parse Tumblr content');
    }
}

/**
 * Detects if a Tumblr post is a reblog and tries to find the original author
 */
function detectTumblrReblog(url, html) {
    const result = {
        isReblog: false,
        originalAuthor: null,
        confidence: 'low'
    };

    // Method 1: Check for reblog indicators in HTML
    const reblogIndicators = [
        /<div[^>]*class="[^"]*reblog[^"]*"/i,
        /<span[^>]*class="[^"]*reblog[^"]*"/i,
        /reblogged\s+from/i,
        /<a[^>]*href="[^"]*tumblr\.com[^"]*"[^>]*>[^<]*reblogged/i
    ];

    for (const indicator of reblogIndicators) {
        if (html.match(indicator)) {
            result.isReblog = true;
            result.confidence = 'medium';
            break;
        }
    }

    // Method 2: Check for "reblogged from" or "via" patterns
    const reblogPatterns = [
        /reblogged\s+from\s+([a-zA-Z0-9_-]+)/i,
        /via\s+([a-zA-Z0-9_-]+)/i,
        /<a[^>]*href="https?:\/\/([a-zA-Z0-9_-]+)\.tumblr\.com"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of reblogPatterns) {
        const match = html.match(pattern);
        if (match) {
            result.isReblog = true;
            result.originalAuthor = match[1];
            result.confidence = 'high';
            break;
        }
    }

    // Method 3: Check URL structure for reblog patterns
    // Tumblr reblogs often have specific URL structures
    const urlReblogPattern = /\/post\/\d+\/.*$/;
    if (urlReblogPattern.test(url)) {
        // If we found content patterns, this increases reblog likelihood
        if (result.confidence !== 'low') {
            result.isReblog = true;
        }
    }

    // Method 4: Look for attribution in post content
    const attributionPatterns = [
        /by\s+([a-zA-Z0-9_-]+)/i,
        /author[:\s]+([a-zA-Z0-9_-]+)/i,
        /written\s+by\s+([a-zA-Z0-9_-]+)/i,
        /@([a-zA-Z0-9_-]+)/g
    ];

    for (const pattern of attributionPatterns) {
        const matches = html.match(pattern);
        if (matches) {
            // Don't overwrite if we already found a good author
            if (!result.originalAuthor) {
                result.originalAuthor = matches[1];
            }
        }
    }

    // Method 5: Check for multiple blog names (indication of reblog chain)
    const blogNameMatches = html.match(/<span[^>]*class="[^"]*blog-name[^"]*"[^>]*>([^<]+)/g);
    if (blogNameMatches && blogNameMatches.length > 1) {
        result.isReblog = true;
        result.confidence = 'medium';
    }

    return result;
}

// You may want to copy createFallbackMetadata from ficParser.js if needed

module.exports = {
    fetchTumblrMetadata,
    detectTumblrReblog
};
