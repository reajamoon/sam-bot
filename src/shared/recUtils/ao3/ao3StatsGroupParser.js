

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
    // Use class-based mapping for AO3 stats fields
    // Find all <dt> elements with a class, skip those inside forms or fieldsets
    $('dt[class], dd[class]').each((i, el) => {
        const $el = $(el);
        if ($el.closest('form, fieldset').length > 0) return;
        if (el.tagName === 'dt') {
            // Use the first class as the field key
            const classList = ($el.attr('class') || '').split(/\s+/);
            if (!classList.length) return;
            $el.data('ao3FieldKey', classList[0]);
        } else if (el.tagName === 'dd') {
            // Find the previous <dt> with a class (and not inside a form/fieldset)
            let prev = el.previousSibling;
            while (prev && (prev.tagName !== 'dt' || !$(prev).attr('class') || $(prev).closest('form, fieldset').length > 0)) {
                prev = prev.previousSibling;
            }
            if (!prev) return;
            const dtClass = ($(prev).attr('class') || '').split(/\s+/)[0];
            if (!dtClass) return;
            const mapped = AO3_FIELD_MAP[dtClass] || dtClass;
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
                const prevVal = stats[mapped];
                let prevDate = prevVal instanceof Date ? prevVal : (typeof prevVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(prevVal) ? new Date(prevVal) : null);
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
                if (mapped === 'chapters') {
                    // Always keep chapters as string (e.g., '1/1')
                    value = val;
                } else if (['words', 'comments', 'kudos', 'bookmarks', 'hits'].includes(mapped)) {
                    value = isNaN(parseInt(val, 10)) ? val : parseInt(val, 10);
                }
                if (stats[mapped] !== value) {
                    stats[mapped] = value;
                }
            } else {
                // Unknown or unmapped field
                // Do not warn about condensed_stats
            }
        }
    });
    return { stats, unknownStats };
}

module.exports = { parseStatsGroup };
