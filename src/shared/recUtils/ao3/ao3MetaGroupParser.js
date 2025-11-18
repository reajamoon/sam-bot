// ao3MetaGroupParser.js
// Extracts and parses AO3 meta group block into a metadata object


const decodeHtmlEntities = require('../decodeHtmlEntities');
const AO3_FIELD_MAP = require('./ao3FieldMap');
const { parseTagList } = require('./parseTagList');

/**
 * Parses all <dt>/<dd> pairs in the entire Cheerio document to extract AO3 metadata fields.
 * @param {CheerioStatic} $ - Cheerio root
 * @returns {Object} metadata
 */
function parseMetaGroup($) {
    const metadata = {};
    const metaFields = {};
    let warnings = [];
    const unknownFields = {};
    // Use class-based mapping for AO3 meta fields
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
            if (dtClass === 'stats') return; // skip stats block
            const mapped = AO3_FIELD_MAP[dtClass] || dtClass;
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
                metaFields[mapped] = parseTagList($, $el);
            } else {
                metaFields[mapped] = decodeHtmlEntities($el.text().replace(/\s+/g, ' ').trim());
            }
        }
    });
    metadata.metaFields = metaFields;
    return metadata;
}

module.exports = { parseMetaGroup };
