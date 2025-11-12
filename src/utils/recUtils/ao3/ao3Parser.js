const { parseAnonymousAO3Fic } = require('./anon');

function isAnonymousAO3Fic(html) {
    return (
        /<h3[^>]*class="byline heading"[^>]*>\s*by\s*Anonymous\s*<\/h3>/i.test(html) ||
        /<a[^>]*rel="author"[^>]*>Anonymous<\/a>/i.test(html) ||
        /<h3[^>]*class="byline heading"[^>]*>\s*by\s*<a[^>]*>Anonymous<\/a>\s*<\/h3>/i.test(html)
    );
}

function parseAO3Metadata(html, url, includeRawHtml = false) {
    // Detect AO3 search results page and treat as error
    const searchWorksTitle = /<title>\s*Search Works \| Archive of Our Own\s*<\/title>/i;
    if (searchWorksTitle.test(html)) {
        const updateMessages = require('../../../commands/recHandlers/updateMessages');
        return {
            error: true,
            message: 'AO3 returned a search results page instead of a fic. The link may be incorrect or AO3 redirected the request.',
            url,
            details: updateMessages.parseError
        };
    }

    // Always declare metadata object at the top
    const metadata = { url: url };
    // Try to find meta block, but don't fail if not found
    const metaBlockMatch = html.match(/<dl class="work meta group">([\s\S]*?)<\/dl>/);
    const metaBlock = metaBlockMatch ? metaBlockMatch[0] : '';

        // Archive Warnings (extract all <a class="tag"> inside <dd class="warning tags">)
        metadata.archiveWarnings = [];
        if (metaBlock) {
            const warningsBlockMatch = metaBlock.match(/<dd class="warning tags">([\s\S]*?)<\/dd>/i);
            if (warningsBlockMatch) {
                const warningsBlock = warningsBlockMatch[1];
                console.log('[AO3 PARSER][DEBUG] Found <dd class="warning tags"> block:', warningsBlock);
                const warningTagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/g;
                let m;
                while ((m = warningTagRegex.exec(warningsBlock)) !== null) {
                    console.log('[AO3 PARSER][DEBUG] Matched warning tag:', m[1]);
                    metadata.archiveWarnings.push(m[1].trim());
                }
            } else {
                console.log('[AO3 PARSER][DEBUG] No <dd class="warning tags"> block found in metaBlock for', url);
            }
        } else {
            console.log('[AO3 PARSER][DEBUG] No metaBlock found in AO3 HTML for', url);
        }
        // Debug log
        console.log('[AO3 PARSER] archiveWarnings for', url, ':', metadata.archiveWarnings);
    const fs = require('fs');
    const path = require('path');

    try {
        if (!html) return null;
        // Check for AO3 'New Session' interstitial
        if (html.includes('<title>New Session') || html.includes('Please log in to continue') || html.includes('name="user_session"')) {
            const updateMessages = require('../../../commands/recHandlers/updateMessages');
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'AO3 session required',
                summary: updateMessages.loginMessage
            };
        }
        // Only treat as site protection if 'cloudflare' appears in the <title> or in a known error header
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch && /cloudflare/i.test(titleMatch[1])) {
            const updateMessages = require('../../../commands/recHandlers/updateMessages');
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: updateMessages.siteProtection
            };
        }
        const headerMatch = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
        if (headerMatch && /cloudflare/i.test(headerMatch[1])) {
            const updateMessages = require('../../../commands/recHandlers/updateMessages');
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: updateMessages.siteProtection
            };
        }
        // Try to find meta block, but don't fail if not found
        const metaBlockMatch = html.match(/<dl class="work meta group">([\s\S]*?)<\/dl>/);
        const metaBlock = metaBlockMatch ? metaBlockMatch[0] : '';

        // Title: try <h2 class="title heading"> anywhere in HTML, never use <title> if it matches a search or site page
        let h2TitleMatch = html.match(/<h2[^>]*class="title heading"[^>]*>([\s\S]*?)<\/h2>/i);
        if (h2TitleMatch) {
            let titleText = h2TitleMatch[1].replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            metadata.title = titleText || 'Unknown Title';
        } else {
            // Fallback: use <title> only if it is not a known AO3 site/search page
            const fallbackTitle = html.match(/<title>([^<]*)<\/title>/i);
            if (fallbackTitle && !/\b(Search Works|Archive of Our Own|User Profile|Bookmarks|Tags|Collections|Works)\b/i.test(fallbackTitle[1])) {
                let t = fallbackTitle[1].replace(/\s*\[Archive of Our Own\]$/, '').trim();
                metadata.title = t || 'Unknown Title';
            } else {
                // If fallback title is a known AO3 site/search page, treat as parse error
                const updateMessages = require('../../../commands/recHandlers/updateMessages');
                return {
                    error: true,
                    message: 'AO3 page did not contain a fic title. The link may be incorrect, or AO3 returned a site/search page.',
                    url,
                    details: updateMessages.parseError
                };
            }
        }

        // Handle Anonymous fics with utility
        if (isAnonymousAO3Fic(html)) {
            return parseAnonymousAO3Fic(html, url);
        }

        // Authors: robust extraction from <h3 class="byline heading">, all <a> tags, else plain text
        let authorMatches = [];
        let bylineMatch = html.match(/<h3[^>]*class="byline heading"[^>]*>([\s\S]*?)<\/h3>/i);
        if (bylineMatch) {
            // Extract all <a> tags (any attributes)
            const authorLinks = [...bylineMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim());
            if (authorLinks.length > 0) {
                authorMatches = authorLinks;
            } else {
                // Fallback: plain text (strip tags)
                const plain = bylineMatch[1].replace(/<[^>]+>/g, '').trim();
                if (plain) authorMatches = [plain];
            }
        }
        // If still not found, fallback to ['Unknown Author']
        metadata.authors = authorMatches.length > 0 ? authorMatches : ['Unknown Author'];

        // Summary
        const summaryMatch = html.match(/<div class="summary module">[\s\S]*?<blockquote class="userstuff">([\s\S]*?)<\/blockquote>/);
        if (summaryMatch) {
            metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        }

        // Fandom
        const fandomMatch = metaBlock.match(/<dd class="fandom tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.fandom = fandomMatch ? fandomMatch[1].trim() : null;
        // Rating
        const ratingMatch = metaBlock.match(/<dd class="rating tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.rating = ratingMatch ? ratingMatch[1].trim() : null;
        // Word count
        const wordMatch = metaBlock.match(/<dt class="words">Words:<\/dt><dd class="words">([^<]+)/);
        if (wordMatch) {
            metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
        }
        // Chapters
        const chapterMatch = metaBlock.match(/<dt class="chapters">Chapters:<\/dt><dd class="chapters">([^<]+)/);
        metadata.chapters = chapterMatch ? chapterMatch[1].trim() : null;
        if (metadata.chapters && metadata.chapters.includes('/')) {
            const [current, total] = metadata.chapters.split('/');
            metadata.status = current === total ? 'Complete' : 'Work in Progress';
        }
        // Tags
        const tagMatches = metaBlock.match(/<dd class="freeform tags">[\s\S]*?<\/dd>/);
        if (tagMatches) {
            const tagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }
        // Language
        const langMatch = metaBlock.match(/<dd class="language" lang="[^"]*">([^<]+)/);
        metadata.language = langMatch ? langMatch[1].trim() : 'English';
        // Published date
        const publishedMatch = metaBlock.match(/<dt class="published">Published:<\/dt><dd class="published">([^<]+)/);
        if (publishedMatch) {
            metadata.publishedDate = new Date(publishedMatch[1].trim()).toISOString().split('T')[0];
        }
        // Updated date
        const updatedMatch = metaBlock.match(/<dt class="status">Completed:<\/dt><dd class="status">([^<]+)/);
        if (updatedMatch) {
            metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
        }
        if (includeRawHtml) metadata.rawHtml = html;

        // If we failed to extract a title or author, treat as parse failure
        if (metadata.title === 'Unknown Title' || !metadata.authors || metadata.authors[0] === 'Unknown Author') {
            // Try one more global search for title/author before giving up
            // Title fallback: search for <title> if <h2> not found
            if (metadata.title === 'Unknown Title') {
                const fallbackTitle = html.match(/<title>([^<]*)<\/title>/i);
                if (fallbackTitle) {
                    // Remove trailing AO3 site name if present
                    let t = fallbackTitle[1].replace(/\s*\[Archive of Our Own\]$/, '').trim();
                    metadata.title = t || 'Unknown Title';
                }
            }
            // Author fallback: search for rel="author" globally
            if (!metadata.authors || metadata.authors[0] === 'Unknown Author') {
                let globalAuthors = [];
                let globalAuthorRegex = /<a rel="author" href="[^"]*">([^<]+)/g;
                let m;
                while ((m = globalAuthorRegex.exec(html)) !== null) {
                    globalAuthors.push(m[1].trim());
                }
                if (globalAuthors.length > 0) metadata.authors = globalAuthors;
            }
        }
        // Final check
        if (metadata.title === 'Unknown Title' || !metadata.authors || metadata.authors[0] === 'Unknown Author') {
            const updateMessages = require('../../../commands/recHandlers/updateMessages');
            return {
                error: true,
                message: updateMessages.parseError,
                url,
            };
        }
        return metadata;
    } catch (err) {
        return {
            error: true,
            message: 'Failed to parse AO3 metadata',
            details: err && err.message ? err.message : err,
        };
    }
}

module.exports = { parseAO3Metadata };
