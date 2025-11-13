// AO3 schema validation
const AO3Schema = require('./ao3Schema');
// Tag extraction utilities
const {
    freeformTags,
    archiveWarnings,
    relationshipTags,
    characterTags,
    categoryTags,
    fandomTags,
    requiredTags
} = require('./parseTagList');

// Universal HTML entity decoder
const decodeHtmlEntities = require('../decodeHtmlEntities');

function parseAO3Metadata(html, url, includeRawHtml = false) {
    const fs = require('fs');
    const path = require('path');
    // Check for incomplete HTML (missing </html> or </body>)
    let htmlIncomplete = false;
    if (!html.includes('</html>') || !html.includes('</body>')) {
        htmlIncomplete = true;
        const logDir = path.join(process.cwd(), 'logs', 'ao3_failed_html');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const fname = `parser_incomplete_${Date.now()}_${url.replace(/[^a-zA-Z0-9]/g, '_').slice(-60)}.html`;
        const fpath = path.join(logDir, fname);
        try {
            fs.writeFileSync(fpath, html, 'utf8');
            console.warn(`[AO3 PARSER] Incomplete HTML detected for ${url}, saved to ${fpath}`);
        } catch (err) {
            console.warn('[AO3 PARSER] Failed to save incomplete HTML:', err);
        }
    }
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

    // ...existing code...

    try {
        if (!html) return null;
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
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

    // Use modular parser for meta group: pass Cheerio root ($) to parse all <dt>/<dd> pairs
    const { parseMetaGroup } = require('./ao3MetaGroupParser');
    const metaGroupData = parseMetaGroup($);
    // Merge metaGroupData into metadata
    Object.assign(metadata, metaGroupData);

    // Stats: use modular parser for stats group
    const { parseStatsGroup } = require('./ao3StatsGroupParser');
    const { stats, unknownStats } = parseStatsGroup($);
        // These fields are now handled by the modular stats/meta group parsers
        if (Object.keys(stats).length > 0) {
            metadata.stats = stats;
        }
        if (Object.keys(unknownStats).length > 0) {
            if (!metadata.unknownStats) metadata.unknownStats = {};
            Object.assign(metadata.unknownStats, unknownStats);
            if (!metadata.warnings) metadata.warnings = [];
            Object.keys(unknownStats).forEach(label => {
                metadata.warnings.push(`Unknown stats field: '${label}' in stats block.`);
            });
        }

        // Title: Use Cheerio for robust extraction
        let titleText = null;
        const h2 = $("h2.title.heading");
        if (h2.length > 0) {
            titleText = h2.first().text().replace(/\s+/g, ' ').trim();
        }
        if (!titleText) {
            // Fallback: <title> tag, strip AO3 site name
            const fallbackTitle = $("title").text();
            if (fallbackTitle) {
                titleText = fallbackTitle.replace(/\s*\[Archive of Our Own\]$/, '').trim();
            }
        }
    metadata.title = decodeHtmlEntities(titleText || 'Unknown Title');
                // Tag fields: use named tag extraction utilities (always include, even if empty)

    // Tag fields: decode all tag strings
    // Scan the entire document for tag fields, not just the meta block
    metadata.freeform_tags = (freeformTags($) || []).map(decodeHtmlEntities);
    metadata.archive_warnings = (archiveWarnings($) || []).map(decodeHtmlEntities);
    metadata.relationship_tags = (relationshipTags($) || []).map(decodeHtmlEntities);
    metadata.character_tags = (characterTags($) || []).map(decodeHtmlEntities);
    metadata.category_tags = (categoryTags($) || []).map(decodeHtmlEntities);
    metadata.fandom_tags = (fandomTags($) || []).map(decodeHtmlEntities);
    metadata.required_tags = (requiredTags($) || []).map(decodeHtmlEntities);

                // Fandom: always as array (from fandom_tags if present)
                if (metadata.fandom_tags && metadata.fandom_tags.length > 0) {
                    metadata.fandom = metadata.fandom_tags.map(decodeHtmlEntities);
                } else {
                    metadata.fandom = [];
                }

                // Always include all tag arrays, even if empty
                const tagFields = [
                    'freeform_tags',
                    'archive_warnings',
                    'relationship_tags',
                    'character_tags',
                    'category_tags',
                    'fandom_tags',
                    'required_tags',
                ];
                for (const key of tagFields) {
                    if (!Array.isArray(metadata[key])) metadata[key] = [];
                }
                // Collections block: handle like meta/stats, with warnings
        const collectionsBlock = $('dd.collections').first();
        const collections = [];
        if (collectionsBlock && collectionsBlock.length > 0) {
            // Extract all <a> children as collection names
            collectionsBlock.find('a').each((i, el) => {
                const name = decodeHtmlEntities($(el).text().trim());
                if (name) collections.push(name);
            });
        }
        if (collections.length > 0) {
            metadata.collections = collections;
        }
        // AO3 author notes are not parsed or included
        // Summary block: handle like meta/stats, with warnings
        const summaryBlock = $('div.summary.module blockquote.userstuff').first();
        if (summaryBlock && summaryBlock.length > 0) {
            // HTML summary: decode only the text content, not the HTML tags
            const summaryText = summaryBlock.text().replace(/\s+/g, ' ').trim();
            metadata.summary = decodeHtmlEntities(summaryText);
        }
        // Authors: Use Cheerio for robust extraction
        let authorMatches = [];
        // Try <a rel="author"> in meta block first
        if (typeof extractMetaGroupFromCheerio === 'function') {
            const metaGroup = extractMetaGroupFromCheerio($);
            if (metaGroup) {
                metaGroup.find("a[rel='author']").each((i, el) => {
                    authorMatches.push(decodeHtmlEntities($(el).text().trim()));
                });
            }
        }
        // If not found, try global <a rel="author">
        if (authorMatches.length === 0) {
            $("a[rel='author']").each((i, el) => {
                authorMatches.push($(el).text().trim());
            });
        }
        // If still not found, try byline heading (may be orphan_account or Anonymous)
        if (authorMatches.length === 0) {
            const byline = $("h3.byline.heading").first();
            if (byline.length > 0) {
                // Look for <a> or plain text
                const authorLinks = byline.find("a[rel='author']");
                if (authorLinks.length > 0) {
                    authorLinks.each((i, el) => {
                        authorMatches.push($(el).text().trim());
                    });
                } else {
                    // Fallback: plain text (may be orphan_account or Anonymous)
                    let bylineText = byline.text().replace(/^by\s+/i, '').trim();
                    if (bylineText) authorMatches.push(bylineText);
                }
            }
        }
        // Final fallback: look for orphan_account or Anonymous anywhere
        if (authorMatches.length === 0) {
            if (/orphan_account/i.test(html)) authorMatches.push('orphan_account');
            if (/Anonymous/i.test(html)) authorMatches.push('Anonymous');
        }
        // If still not found, fallback to ['Unknown Author']
        metadata.authors = authorMatches.length > 0 ? authorMatches : ['Unknown Author'];

        // Summary
        const summaryMatch = html.match(/<div class="summary module">[\s\S]*?<blockquote class="userstuff">([\s\S]*?)<\/blockquote>/);
        if (summaryMatch) {
            metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        }

    // (Fandom handled above as array)

        // Remove legacy/redundant top-level fields and move to stats if present
        // (rating, wordCount, chapters, status, publishedDate, updatedDate)
        // These should only be present in metadata.stats or as defined in the schema
        // If stats exists, merge/override with any legacy fields
        if (!metadata.stats) metadata.stats = {};
        // Move rating
        if (typeof metadata.rating === 'string') {
            metadata.stats.rating = metadata.rating;
            delete metadata.rating;
        }
        // Move wordCount
        if (typeof metadata.wordCount === 'number') {
            metadata.stats.words = metadata.wordCount;
            delete metadata.wordCount;
        }
        // Move chapters
        if (typeof metadata.chapters === 'string') {
            metadata.stats.chapters = metadata.chapters;
            delete metadata.chapters;
        }
        // Move status
        if (typeof metadata.status === 'string') {
            metadata.stats.status = metadata.status;
            delete metadata.status;
        }
        // Move publishedDate
        if (typeof metadata.publishedDate === 'string') {
            metadata.stats.published = metadata.publishedDate;
            delete metadata.publishedDate;
        }
        // Move updatedDate
        if (typeof metadata.updatedDate === 'string') {
            metadata.stats.updated = metadata.updatedDate;
            delete metadata.updatedDate;
        }
        // Move completedDate (if present)
        if (typeof metadata.completedDate === 'string') {
            metadata.stats.completed = metadata.completedDate;
            delete metadata.completedDate;
        }
        // Move language (should remain top-level, not in stats)
        if (typeof metadata.language === 'string') {
            // leave as is
        }

        // Fix stats fields: ensure published/updated/completed are strings if present
        ['published', 'updated', 'completed'].forEach((key) => {
            if (metadata.stats[key] && typeof metadata.stats[key] !== 'string') {
                metadata.stats[key] = String(metadata.stats[key]);
            }
        });

        // Fix chapters: ensure chapters is a string
        if (metadata.stats.chapters && typeof metadata.stats.chapters !== 'string') {
            metadata.stats.chapters = String(metadata.stats.chapters);
        }

        // Fix all stats int fields: words, comments, kudos, bookmarks, hits
        ['words', 'comments', 'kudos', 'bookmarks', 'hits'].forEach((key) => {
            if (metadata.stats[key] && typeof metadata.stats[key] !== 'number') {
                const num = parseInt(metadata.stats[key], 10);
                if (!isNaN(num)) metadata.stats[key] = num;
            }
        });
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

        // Always include url field
        metadata.url = url || metadata.url || null;

        // Validate with Zod schema
        const validation = AO3Schema.safeParse(metadata);
        if (!validation.success) {
            return {
                error: true,
                message: 'AO3 metadata schema validation failed',
                url,
                validationErrors: validation.error ? validation.error.errors : [],
                metadata,
            };
        }
        return { metadata: validation.data };
    } catch (err) {
        return {
            error: true,
            message: 'Failed to parse AO3 metadata',
            details: err && err.message ? err.message : err,
        };
    }
}

module.exports = { parseAO3Metadata };
