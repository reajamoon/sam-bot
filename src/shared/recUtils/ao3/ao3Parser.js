import AO3Schema from './ao3Schema.js';
import {
    freeformTags,
    archiveWarnings,
    relationshipTags,
    characterTags,
    categoryTags,
    fandomTags,
    requiredTags
} from './parseTagList.js';
import decodeHtmlEntities from '../decodeHtmlEntities.js';
import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';

function parseAO3Metadata(html, url, includeRawHtml = false) {
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
        const updateMessages = await import('../../text/updateMessages.js');
        return {
            error: true,
            message: 'AO3 returned a search heading.',
            url,
            details: updateMessages.default.parseError
        };
    }


    // Always declare metadata object at the top
    const metadata = { url: url };
    try {
        if (!html) return null;
        const $ = cheerio.load(html);
        // Check for AO3 'New Session' interstitial
        if (html.includes('<title>New Session') || html.includes('Please log in to continue') || html.includes('name="user_session"')) {
            const updateMessages = await import('../../text/updateMessages.js');
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'AO3 session required',
                summary: updateMessages.default.loginMessage
            };
        }
        // Only treat as site protection if 'cloudflare' appears in the <title> or in a known error header
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch && /cloudflare/i.test(titleMatch[1])) {
            const updateMessages = await import('../../text/updateMessages.js');
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: updateMessages.default.siteProtection
            };
        }
        const headerMatch = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
        if (headerMatch && /cloudflare/i.test(headerMatch[1])) {
            const updateMessages = await import('../../text/updateMessages.js');
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: updateMessages.default.siteProtection
            };
        }
        const metadata = { url: url };

    // Use modular parser for meta group: pass Cheerio root ($) to parse all <dt>/<dd> pairs
    const { parseMetaGroup } = await import('./ao3MetaGroupParser.js');
    const metaGroupData = parseMetaGroup($);
    // Merge metaGroupData into metadata
    Object.assign(metadata, metaGroupData);

    // Stats: use modular parser for stats group
    const { parseStatsGroup } = await import('./ao3StatsGroupParser.js');
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
        // Promote stats fields to top-level with expected names (especially chapters!)
        if (metadata.stats.rating) metadata.rating = metadata.stats.rating;
        if (metadata.stats.words) metadata.wordCount = metadata.stats.words;
        if (metadata.stats.chapters) metadata.chapters = metadata.stats.chapters;
        if (metadata.stats.published) metadata.publishedDate = metadata.stats.published;
        if (metadata.stats.updated) metadata.updatedDate = metadata.stats.updated;
        if (metadata.stats.kudos) metadata.kudos = metadata.stats.kudos;

        // --- Robust status extraction ---
        // 1. Check for AO3 'complete-yes'/'complete-no' icons
        let statusFromIcon = null;
        if (typeof $ === 'function') {
            if ($('img[src$="complete-yes.png"]').length > 0) statusFromIcon = 'Complete';
            else if ($('img[src$="complete-no.png"]').length > 0) statusFromIcon = 'In Progress';
        }
        // 2. Parse chapters field for N/N, N/?, ?/?
        let statusFromChapters = null;
        if (typeof metadata.chapters === 'string') {
            const match = metadata.chapters.match(/^(\d+)\s*\/\s*(\d+|\?)/);
            if (match) {
                const num1 = parseInt(match[1], 10);
                const num2 = match[2] === '?' ? null : parseInt(match[2], 10);
                if (num2 && num1 === num2 && num1 > 0) statusFromChapters = 'Complete';
                else if (num2 === null || num1 < (num2 || 0)) statusFromChapters = 'In Progress';
            }
        }
        // 3. Abandoned tag
        const abandonedTag = 'Abandoned Work - Unfinished and Discontinued';
        let freeformTagsArr = [];
        if (Array.isArray(metadata.freeform_tags)) {
            freeformTagsArr = metadata.freeform_tags.map(t => t.trim().toLowerCase());
        } else if (Array.isArray(metadata.tags)) {
            freeformTagsArr = metadata.tags.map(t => t.trim().toLowerCase());
        }
        let statusFromAbandoned = null;
        if (freeformTagsArr.includes(abandonedTag.toLowerCase())) {
            statusFromAbandoned = 'Abandoned';
        }
        // 4. Completed date field
        let statusFromCompleted = null;
        if (typeof metadata.stats.completed !== 'undefined') {
            if (metadata.stats.completed && metadata.stats.completed.trim() !== '') {
                statusFromCompleted = 'Complete';
                metadata.completedDate = metadata.stats.completed;
            } else {
                statusFromCompleted = 'In Progress';
            }
        }
        // 5. Fallback to stats.status if present
        let statusFromStats = null;
        if (metadata.stats.status) statusFromStats = metadata.stats.status;

        // Priority: Abandoned > Complete > In Progress > Unknown
        // Normalize status to a fixed set
        function normalizeStatus(val) {
            if (!val) return 'Unknown';
            const v = String(val).toLowerCase();
            if (v.includes('abandon')) return 'Abandoned';
            if (v === 'complete' || v === 'completed') return 'Complete';
            if (v === 'in progress' || v === 'work in progress' || v === 'wip' || v === 'incomplete') return 'In Progress';
            return 'Unknown';
        }
        metadata.status = normalizeStatus(
            statusFromAbandoned
            || statusFromIcon
            || statusFromChapters
            || statusFromCompleted
            || statusFromStats
            || 'Unknown'
        );
            if (metadata.stats.updated) metadata.updatedDate = metadata.stats.updated;
            if (metadata.stats.kudos) metadata.kudos = metadata.stats.kudos;
            if (metadata.stats.published) metadata.publishedDate = metadata.stats.published;
            if (metadata.stats.updated) metadata.updatedDate = metadata.stats.updated;
            if (metadata.stats.kudos) metadata.kudos = metadata.stats.kudos;
        metadata.kudos = (typeof metadata.stats.kudos === 'number') ? metadata.stats.kudos : 0;
        metadata.hits = (typeof metadata.stats.hits === 'number') ? metadata.stats.hits : 0;
        metadata.bookmarks = (typeof metadata.stats.bookmarks === 'number') ? metadata.stats.bookmarks : 0;
        metadata.comments = (typeof metadata.stats.comments === 'number') ? metadata.stats.comments : 0;
        // Promote category if present
            if (metadata.category_tags && metadata.category_tags.length > 0) {
                    metadata.category = metadata.category_tags[0];
                    }
        // Promote archive_warnings to archiveWarnings (camelCase for normalization)
            if (metadata.archive_warnings) {
                    metadata.archiveWarnings = metadata.archive_warnings;
                        delete metadata.archive_warnings;
                        }
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
        // Debug: log extracted title, authors, and summary for troubleshooting (only if metadata exists)
        try {
            const fs = require('fs');
            const path = require('path');
            const debugLogDir = path.join(process.cwd(), 'logs', 'ao3_parser_debug');
            if (!fs.existsSync(debugLogDir)) fs.mkdirSync(debugLogDir, { recursive: true });
            const debugObj = {
                url,
                extractedTitle: metadata.title,
                extractedAuthors: metadata.authors,
                extractedSummary: metadata.summary,
                allMetadata: metadata
            };
            // const fname = `parser_debug_${Date.now()}_${url ? url.replace(/[^a-zA-Z0-9]/g, '_').slice(-60) : 'no_url'}.json`;
            // const fpath = path.join(debugLogDir, fname);
            // fs.writeFileSync(fpath, JSON.stringify(debugObj, null, 2), 'utf8');
            // console.warn(`[AO3 PARSER DEBUG] Saved parser debug info for ${url} to ${fpath}`);
        } catch (err) {
            console.warn('[AO3 PARSER DEBUG] Failed to save parser debug info:', err);
        }
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


export { parseAO3Metadata };
