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

        // --- Promote all required fields to top-level for Zod/schema alignment ---
        if (!metadata.stats) metadata.stats = {};
        // Promote stats fields to top-level with expected names
        // Check for canonical AO3 abandoned tag in freeform tags
        // If status is still not set, infer from chapters field (N/N where N == N means complete)
        if (typeof metadata.chapters === 'string') {
            const match = metadata.chapters.match(/^(\d+)\s*\/\s*(\d+)$/);
            if (match) {
                const num1 = parseInt(match[1], 10);
                const num2 = parseInt(match[2], 10);
                if (!isNaN(num1) && !isNaN(num2) && num1 === num2 && num1 > 0) {
                    metadata.status = 'Complete';
                }
            }
        }
        const abandonedTag = 'Abandoned Work - Unfinished and Discontinued';
        let freeformTagsArr = [];
        if (Array.isArray(metadata.freeform_tags)) {
            freeformTagsArr = metadata.freeform_tags.map(t => t.trim().toLowerCase());
        } else if (Array.isArray(metadata.tags)) {
            freeformTagsArr = metadata.tags.map(t => t.trim().toLowerCase());
        }
        if (freeformTagsArr.includes(abandonedTag.toLowerCase())) {
            if (!metadata.status || metadata.status.toLowerCase() !== 'deleted') {
                metadata.status = 'Abandoned';
            }
        }
        if (metadata.stats.rating) metadata.rating = metadata.stats.rating;
        if (metadata.stats.words) metadata.wordCount = metadata.stats.words;
        if (metadata.stats.chapters) metadata.chapters = metadata.stats.chapters;
        // AO3 does not provide a direct status field; infer from completed
        if (typeof metadata.stats.completed !== 'undefined') {
            // AO3 marks completed as a date string if complete, or empty/undefined if not
            if (metadata.stats.completed && metadata.stats.completed.trim() !== '') {
                metadata.status = 'Complete';
                metadata.completedDate = metadata.stats.completed;
            } else {
                metadata.status = 'In Progress';
            }
        }
        if (metadata.stats.status) metadata.status = metadata.stats.status; // fallback if present
        if (metadata.stats.published) metadata.publishedDate = metadata.stats.published;
        if (metadata.stats.updated) metadata.updatedDate = metadata.stats.updated;
        if (metadata.stats.kudos) metadata.kudos = metadata.stats.kudos;
        if (metadata.stats.hits) metadata.hits = metadata.stats.hits;
        if (metadata.stats.bookmarks) metadata.bookmarks = metadata.stats.bookmarks;
        if (metadata.stats.comments) metadata.comments = metadata.stats.comments;
        // Promote category if present
        if (metadata.category_tags && metadata.category_tags.length > 0) {
            metadata.category = metadata.category_tags[0];
        }
        // Promote archive_warnings to archiveWarnings (camelCase for normalization)
        if (metadata.archive_warnings) metadata.archiveWarnings = metadata.archive_warnings;
        // Always include url field
        metadata.url = url || metadata.url || null;
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
