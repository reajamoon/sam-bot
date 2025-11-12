const { parseAnonymousAO3Fic } = require('./anon');

function isAnonymousAO3Fic(html) {
    return (
        /<h3[^>]*class="byline heading"[^>]*>\s*by\s*Anonymous\s*<\/h3>/i.test(html) ||
        /<a[^>]*rel="author"[^>]*>Anonymous<\/a>/i.test(html) ||
        /<h3[^>]*class="byline heading"[^>]*>\s*by\s*<a[^>]*>Anonymous<\/a>\s*<\/h3>/i.test(html)
    );
}

function parseAO3Metadata(html, url, includeRawHtml = false) {
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
        const metadata = { url: url };
        // Try to find meta block, but don't fail if not found
        const metaBlockMatch = html.match(/<dl class="work meta group">([\s\S]*?)<\/dl>/);
        const metaBlock = metaBlockMatch ? metaBlockMatch[0] : '';

        // Title: try meta block, then global
        let h2TitleMatch = metaBlock.match(/<h2 class="title heading">([\s\S]*?)<\/h2>/);
        if (!h2TitleMatch) {
            h2TitleMatch = html.match(/<h2 class="title heading">([\s\S]*?)<\/h2>/);
        }
        if (h2TitleMatch) {
            let titleText = h2TitleMatch[1].replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            metadata.title = titleText || 'Unknown Title';
        } else {
            metadata.title = 'Unknown Title';
        }

        // Handle Anonymous fics with utility
        if (isAnonymousAO3Fic(html)) {
            return parseAnonymousAO3Fic(html, url);
        }

        // Authors: try meta block, then global, support multiple
        let authorMatches = [];
        // Try meta block first
        let authorRegex = /<a rel="author" href="[^"]*">([^<]+)/g;
        let match;
        if (metaBlock) {
            while ((match = authorRegex.exec(metaBlock)) !== null) {
                authorMatches.push(match[1].trim());
            }
        }
        // If not found, try global
        if (authorMatches.length === 0) {
            let bylineMatch = html.match(/<h3 class="byline heading">([\s\S]*?)<\/h3>/);
            if (bylineMatch) {
                let bylineHtml = bylineMatch[1];
                authorRegex.lastIndex = 0;
                while ((match = authorRegex.exec(bylineHtml)) !== null) {
                    authorMatches.push(match[1].trim());
                }
            }
        }
        // If still not found, try global search for all rel="author"
        if (authorMatches.length === 0) {
            authorRegex.lastIndex = 0;
            while ((match = authorRegex.exec(html)) !== null) {
                authorMatches.push(match[1].trim());
            }
        }
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
