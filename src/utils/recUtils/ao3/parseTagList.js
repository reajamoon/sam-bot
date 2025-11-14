// Utility to extract an array of tag strings from a Cheerio <dd> element
// Usage: const tags = parseTagList($, ddElement);

const decodeHtmlEntities = require('../decodeHtmlEntities');

/**
 * Extracts an array of tag strings from a Cheerio <dd> element containing AO3 tags.
 * @param {CheerioStatic} $ - The Cheerio instance.
 * @param {Cheerio} ddElement - The <dd> element containing <a class="tag"> children.
 * @returns {string[]} Array of tag strings.
 */
function parseTagList($, ddElem) {
    if (!ddElem || ddElem.length === 0) return [];
    const tags = [];
    ddElem.find('a.tag').each((i, el) => {
        const tag = $(el).text().trim();
        if (tag) tags.push(decodeHtmlEntities(tag));
    });
    return tags;
}

// Named tag extraction functions for each AO3 tag type
// Each expects a Cheerio object for the <dl> or <dd> containing the relevant tags

// Freeform tags ("Additional Tags")
function excludeChapters($, selector) {
    // Select all matching elements not inside #chapters
    return $(selector).filter(function () {
        return $(this).closest('#chapters').length === 0;
    });
}

function freeformTags($) {
    return parseTagList($, excludeChapters($, 'dd.freeform.tags'));
}

function archiveWarnings($) {
    return parseTagList($, excludeChapters($, 'dd.warning.tags'));
}

function relationshipTags($) {
    return parseTagList($, excludeChapters($, 'dd.relationship.tags'));
}

function characterTags($) {
    return parseTagList($, excludeChapters($, 'dd.character.tags'));
}

function categoryTags($) {
    return parseTagList($, excludeChapters($, 'dd.category.tags'));
}

function fandomTags($) {
    return parseTagList($, excludeChapters($, 'dd.fandom.tags'));
}

function requiredTags($) {
    return parseTagList($, excludeChapters($, 'dd.required.tags'));
}

// General utility for custom tag class
function customTags($, dlElem, className) {
    return parseTagList($, dlElem.find(`dd.${className}.tags`));
}

module.exports = {
    parseTagList,
    freeformTags,
    archiveWarnings,
    relationshipTags,
    characterTags,
    categoryTags,
    fandomTags,
    requiredTags,
    customTags,
};
