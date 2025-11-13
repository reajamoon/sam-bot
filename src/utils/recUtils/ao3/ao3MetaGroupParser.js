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
    let lastLabel = null;
    let warnings = [];
    const unknownFields = {};
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
            if (lastLabel) {
                warnings.push(`Warning: <dt> '${lastLabel}' missing corresponding <dd> in meta block.`);
            }
            lastLabel = label;
        } else if (el.tagName === 'dd' && lastLabel) {
            if (lastLabel === 'stats') {
                lastLabel = null;
                return;
            }
            const mapped = AO3_FIELD_MAP[lastLabel];
            if (mapped) {
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
                    metaFields[mapped] = parseTagList($, $el);
                } else {
                    metaFields[mapped] = decodeHtmlEntities($el.text().replace(/\s+/g, ' ').trim());
                }
            } else {
                const value = $el.text().replace(/\s+/g, ' ').trim();
                unknownFields[lastLabel] = decodeHtmlEntities(value);
                warnings.push(`Unknown meta field: '${lastLabel}' found in meta block.`);
            }
            lastLabel = null;
        }
    });
    if (lastLabel) {
        warnings.push(`Warning: <dt> '${lastLabel}' missing corresponding <dd> at end of meta block.`);
    }
    if (warnings.length > 0) metadata.warnings = warnings;
    if (Object.keys(unknownFields).length > 0) metadata.unknownFields = unknownFields;
    metadata.metaFields = metaFields;
    return metadata;
}

module.exports = { parseMetaGroup };
