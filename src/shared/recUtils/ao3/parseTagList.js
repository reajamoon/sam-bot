// Utility to extract an array of tag strings from a Cheerio <dd> element
// Usage: const tags = parseTagList($, ddElement);

import decodeHtmlEntities from '../decodeHtmlEntities.js';

/**
 * Extracts an array of tag strings from a Cheerio <dd> element containing AO3 tags.
 * @param {CheerioStatic} $ - The Cheerio instance.
 * @param {Cheerio} ddElement - The <dd> element containing <a class="tag"> children.
 * @returns {string[]} Array of tag strings.
 */
export function parseTagList($, ddElem) {
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

export function freeformTags($) {
    return parseTagList($, excludeChapters($, 'dd.freeform.tags'));
}

export function archiveWarnings($) {
    return parseTagList($, excludeChapters($, 'dd.warning.tags'));
}

export function relationshipTags($) {
    return parseTagList($, excludeChapters($, 'dd.relationship.tags'));
}

export function characterTags($) {
    return parseTagList($, excludeChapters($, 'dd.character.tags'));
}

export function categoryTags($) {
    return parseTagList($, excludeChapters($, 'dd.category.tags'));
}

export function fandomTags($) {
    return parseTagList($, excludeChapters($, 'dd.fandom.tags'));
}

export function requiredTags($) {
    return parseTagList($, excludeChapters($, 'dd.required.tags'));
}

// General utility for custom tag class
export function customTags($, dlElem, className) {
    return parseTagList($, dlElem.find(`dd.${className}.tags`));
}
