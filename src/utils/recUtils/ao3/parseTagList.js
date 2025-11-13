// Utility to extract an array of tag strings from a Cheerio <dd> element
// Usage: const tags = parseTagList($, ddElement);

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
        if (tag) tags.push(tag);
    });
    return tags;
}

// Named tag extraction functions for each AO3 tag type
// Each expects a Cheerio object for the <dl> or <dd> containing the relevant tags

// Freeform tags ("Additional Tags")
function freeformTags($, dlElem) {
    return parseTagList($, dlElem.find('dd.freeform.tags'));
}

// Archive Warnings
function archiveWarnings($, dlElem) {
    return parseTagList($, dlElem.find('dd.warning.tags'));
}

// Relationship tags
function relationshipTags($, dlElem) {
    return parseTagList($, dlElem.find('dd.relationship.tags'));
}

// Character tags
function characterTags($, dlElem) {
    return parseTagList($, dlElem.find('dd.character.tags'));
}

// Category tags (e.g., F/M, Gen)
function categoryTags($, dlElem) {
    return parseTagList($, dlElem.find('dd.category.tags'));
}

// Fandom tags
function fandomTags($, dlElem) {
    return parseTagList($, dlElem.find('dd.fandom.tags'));
}

// Required Tags (AO3's four required warnings, as a string array)
function requiredTags($, dlElem) {
    // AO3 sometimes puts these in dd.required.tags
    return parseTagList($, dlElem.find('dd.required.tags'));
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
