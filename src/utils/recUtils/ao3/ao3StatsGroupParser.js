

const AO3_FIELD_MAP = require('./ao3FieldMap');
const { parseTagList } = require('./parseTagList');

/**
 * Parses all <dt>/<dd> pairs in the document to extract AO3 stats fields, not just in stats blocks.
 * Prevents duplication by only setting a field if it is not already set.
 * @param {CheerioStatic} $ - Cheerio root
 * @returns {{ stats: Object, unknownStats: Object }}
 */
function parseStatsGroup($) {
    const stats = {};
    const unknownStats = {};
    let lastLabel = null;
    // Find all <dt> and <dd> pairs in the document, but skip those inside forms or fieldsets
    const allDtDd = [];
    $('dt, dd').each((i, el) => {
        const $el = $(el);
        if ($el.closest('form, fieldset').length === 0) {
            allDtDd.push(el);
        }
    });
    allDtDd.forEach((el) => {
        const $el = $(el);
        if (el.tagName === 'dt') {
            let label = $el.text().replace(/[:\s\(\)]+/g, '_').toLowerCase().replace(/_+$/,'').replace(/^_+/, '');
            lastLabel = label;
        } else if (el.tagName === 'dd' && lastLabel) {
            const mapped = AO3_FIELD_MAP[lastLabel] || lastLabel;
            // For tag fields, use parseTagList to extract arrays
            if ([
                'freeform_tags',
                'archive_warnings',
                'relationship_tags',
                'character_tags',
                'category_tags',
                'fandom_tags',
                'required_tags',
                'collections'
            ].includes(mapped)) {
                stats[mapped] = parseTagList($, $el);
            } else if ([
                'published', 'updated', 'completed'
            ].includes(mapped)) {
                // For date fields, only overwrite if newer
                const prev = stats[mapped];
                let prevDate = prev instanceof Date ? prev : (typeof prev === 'string' && /^\d{4}-\d{2}-\d{2}/.test(prev) ? new Date(prev) : null);
                let newDate = $el.text().replace(/,/g, '').trim();
                if (!prevDate || (newDate && newDate > prevDate)) {
                    stats[mapped] = newDate;
                }
            } else if ([
                'words', 'chapters', 'comments', 'kudos', 'bookmarks', 'hits', 'rating', 'language'
            ].includes(mapped)) {
                // For numeric/string stats, rating, and language, only overwrite if different
                let val = $el.text().replace(/,/g, '').trim();
                let value = val;
                if (['words', 'chapters', 'comments', 'kudos', 'bookmarks', 'hits'].includes(mapped)) {
                    value = isNaN(parseInt(val, 10)) ? val : parseInt(val, 10);
                }
                if (stats[mapped] !== value) {
                    stats[mapped] = value;
                }
            } else {
                // Unknown or unmapped field
                    // Do not warn about condensed_stats
            }
            lastLabel = null;
        }
    });
    return { stats, unknownStats };
}

module.exports = { parseStatsGroup };
