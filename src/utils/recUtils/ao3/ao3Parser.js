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

    try {
        if (!html) return null;
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        // Check for AO3 'New Session' interstitial
        if (html.includes('<title>New Session') || html.includes('Please log in to continue') || html.includes('name="user_session"')) {
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'AO3 session required',
                summary: 'AO3 is requiring a login or new session. Please log in to AO3 and try again.'
            };
        }
        // Only treat as site protection if 'cloudflare' appears in the <title> or in a known error header
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch && /cloudflare/i.test(titleMatch[1])) {
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: 'Site protection is blocking metadata fetch.'
            };
        }
        const headerMatch = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
        if (headerMatch && /cloudflare/i.test(headerMatch[1])) {
            return {
                title: 'Unknown Title',
                authors: ['Unknown Author'],
                url: url,
                error: 'Site protection detected',
                summary: 'Site protection is blocking metadata fetch.'
            };
        }
        const metadata = { url: url };
        // Use Cheerio to find the meta block
        const metaBlock = $('dl.work.meta.group').first();
        if (!metaBlock || metaBlock.length === 0) {
            // Fallback: log and return parse error as before
            // Log a summary of the HTML for debugging (avoid logging full HTML in prod)
            if (typeof console !== 'undefined' && console.warn) {
                const snippet = html ? html.slice(0, 500) : '[no html]';
                console.warn('[AO3Parser] Meta block missing. HTML snippet:', snippet);
            }
            return {
                error: true,
                message: 'Failed to locate AO3 meta block',
                url
            };
        }


        // Iterate <dt>/<dd> pairs in meta block using Cheerio
        const metaFields = {};
        let lastLabel = null;
        let warnings = [];
        const unknownFields = {};
        // AO3 field label to normalized key mapping
        // This mapping is used to translate normalized AO3 <dt> labels to canonical output keys.
        // Unknown fields are added dynamically to unknownFields.
        const AO3_FIELD_MAP = {
            'rating': 'rating',
            'ratings': 'rating',
            'archive_warning': 'archive_warnings',
            'archive_warnings': 'archive_warnings',
            'category': 'category_tags',
            'categories': 'category_tags',
            'fandom': 'fandom_tags',
            'fandoms': 'fandom_tags',
            'relationship': 'relationship_tags',
            'relationships': 'relationship_tags',
            'character': 'character_tags',
            'characters': 'character_tags',
            'additional_tags': 'freeform_tags',
            'freeform_tags': 'freeform_tags',
            'language': 'language',
            'collections': 'collections',
            'published': 'published',
            'updated': 'updated',
            'completed': 'completed',
            'words': 'word_count',
            'word_count': 'word_count',
            'chapters': 'chapters',
            'comments': 'comments',
            'kudos': 'kudos',
            'bookmarks': 'bookmarks',
            'hits': 'hits',
            // Add more mappings as needed
        };
        metaBlock.children().each((i, el) => {
            const $el = $(el);
            if (el.tagName === 'dt') {
                // Normalize label: get text, lowercase, trim, replace spaces/colons/parentheses with underscores
                let label = $el.text().replace(/[:\s\(\)]+/g, '_').toLowerCase().replace(/_+$/,'').replace(/^_+/, '');
                // If previous <dt> was not followed by <dd>, log a warning
                if (lastLabel) {
                    warnings.push(`Warning: <dt> '${lastLabel}' missing corresponding <dd> in meta block.`);
                }
                lastLabel = label;
            } else if (el.tagName === 'dd' && lastLabel) {
                if (lastLabel === 'stats') {
                    // Skip stats field in meta block; handled separately
                    lastLabel = null;
                    return;
                }
                if (AO3_FIELD_MAP[lastLabel]) {
                    metaFields[lastLabel] = $el;
                } else {
                    // Unknown field: log and store
                    const value = $el.text().replace(/\s+/g, ' ').trim();
                    unknownFields[lastLabel] = decodeHtmlEntities(value);
                    warnings.push(`Unknown meta field: '${lastLabel}' found in meta block.`);
                }
                lastLabel = null;
            }
        });
        // If the last <dt> is not followed by a <dd>, log a warning
        if (lastLabel) {
            warnings.push(`Warning: <dt> '${lastLabel}' missing corresponding <dd> at end of meta block.`);
        }
        // Only attach warnings if present (do not attach metaFields, which contains Cheerio objects)
        if (warnings.length > 0) metadata.warnings = warnings;
        // Attach unknownFields if any
        if (Object.keys(unknownFields).length > 0) {
            metadata.unknownFields = unknownFields;
        }

        // Stats: use parseStatsBlock utility
        const parseStatsBlock = require('./parseStatsBlock');
        const statsBlock = $('dl.stats').first();
        const { stats, unknownStats } = parseStatsBlock($, statsBlock);
        // Fix published date: extract from <dd class="published"> and save as Date object if possible
        const publishedElem = metaBlock.find('dd.published').first();
        if (publishedElem.length > 0) {
            let publishedText = publishedElem.attr('title') || publishedElem.text().trim();
            if (/^\d{4}$/.test(publishedText)) {
                const titleAttr = publishedElem.attr('title');
                if (titleAttr && /^\d{4}-\d{2}-\d{2}$/.test(titleAttr)) {
                    publishedText = titleAttr;
                }
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(publishedText)) {
                // Always save as Date object (UTC, no time)
                const [year, month, day] = publishedText.split('-').map(Number);
                if (year && month && day) {
                    stats.published = new Date(Date.UTC(year, month - 1, day));
                } else {
                    stats.published = publishedText;
                }
            } else if (/^\d{4}$/.test(publishedText)) {
                stats.published = publishedText;
            }
        }
        // Fix updated date: extract from <dd class="status"> or <dd class="updated"> and save as Date object if possible
        let updatedElem = metaBlock.find('dd.status').first();
        if (!updatedElem.length) updatedElem = metaBlock.find('dd.updated').first();
        if (updatedElem.length > 0) {
            let updatedText = updatedElem.attr('title') || updatedElem.text().trim();
            if (/^\d{4}$/.test(updatedText)) {
                const titleAttr = updatedElem.attr('title');
                if (titleAttr && /^\d{4}-\d{2}-\d{2}$/.test(titleAttr)) {
                    updatedText = titleAttr;
                }
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(updatedText)) {
                // Always save as Date object (UTC, no time)
                const [year, month, day] = updatedText.split('-').map(Number);
                if (year && month && day) {
                    stats.updated = new Date(Date.UTC(year, month - 1, day));
                } else {
                    stats.updated = updatedText;
                }
            } else if (/^\d{4}$/.test(updatedText)) {
                stats.updated = updatedText;
            }
        }
        // Fix chapters: ensure format is N/N or N/? as string
        const chaptersElem = metaBlock.find('dd.chapters').first();
        if (chaptersElem.length > 0) {
            let chaptersText = chaptersElem.text().trim();
            // AO3 format is N/N or N/?
            if (/^\d+\s*\/\s*(\d+|\?)$/.test(chaptersText)) {
                stats.chapters = chaptersText.replace(/\s+/g, '');
            } else if (/^\d+$/.test(chaptersText)) {
                // If only a single number, treat as N/?
                stats.chapters = chaptersText + '/?';
            }
        }
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
    metadata.freeform_tags = (freeformTags($, metaBlock) || []).map(decodeHtmlEntities);
    metadata.archive_warnings = (archiveWarnings($, metaBlock) || []).map(decodeHtmlEntities);
    metadata.relationship_tags = (relationshipTags($, metaBlock) || []).map(decodeHtmlEntities);
    metadata.character_tags = (characterTags($, metaBlock) || []).map(decodeHtmlEntities);
    metadata.category_tags = (categoryTags($, metaBlock) || []).map(decodeHtmlEntities);
    metadata.fandom_tags = (fandomTags($, metaBlock) || []).map(decodeHtmlEntities);
    metadata.required_tags = (requiredTags($, metaBlock) || []).map(decodeHtmlEntities);

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
        // Notes block: extract only the main user-facing notes as plain text
        const notesBlock = $('div.notes.module').first();
        if (notesBlock && notesBlock.length > 0) {
            // Prefer the <blockquote class="userstuff"> if present
            const userstuff = notesBlock.find('blockquote.userstuff').first();
            let notesText = '';
            if (userstuff && userstuff.length > 0) {
                notesText = userstuff.text().replace(/\s+/g, ' ').trim();
            } else {
                // Fallback: get all text from notesBlock, strip whitespace
                notesText = notesBlock.text().replace(/\s+/g, ' ').trim();
            }
            if (notesText) metadata.notes = decodeHtmlEntities(notesText);
        }
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
        $("dl.work.meta.group a[rel='author']").each((i, el) => {
            authorMatches.push(decodeHtmlEntities($(el).text().trim()));
        });
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
