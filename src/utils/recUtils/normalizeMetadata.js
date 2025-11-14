/**
 * Normalizes metadata field names to AO3 terminology
 * @param {Object} metadata - The metadata object to normalize
 * @param {string} source - The source site (e.g., 'wattpad', 'ffnet', 'tumblr')
 * @returns {Object} - Normalized metadata object
 */
function normalizeMetadata(metadata, source) {
    const normalized = { ...metadata };

    // --- Rating normalization (AO3 canonical names) ---
    if (normalized.rating && typeof normalized.rating === 'string') {
        const ratingMap = {
            'k': 'General Audiences',
            'k+': 'Teen And Up Audiences',
            't': 'Teen And Up Audiences',
            'm': 'Mature',
            'ma': 'Explicit',
            'explicit': 'Explicit',
            'mature': 'Mature',
            'teen': 'Teen And Up Audiences',
            'teen and up': 'Teen And Up Audiences',
            'teen and up audiences': 'Teen And Up Audiences',
            'general': 'General Audiences',
            'general audiences': 'General Audiences',
            'g': 'General Audiences',
            'not rated': 'Not Rated',
            'unrated': 'Not Rated',
            'n/a': 'Not Rated',
            'none': 'Not Rated'
        };
        const key = normalized.rating.trim().toLowerCase();
        if (ratingMap[key]) {
            normalized.rating = ratingMap[key];
        }
    }

    // --- Archive Warnings normalization ---
    // Prefer archiveWarnings, fallback to archive_warnings, fallback to archive_warnings (snake_case)
    let archiveWarnings = normalized.archiveWarnings || normalized.archive_warnings || normalized.archive_warnings;
    if (!archiveWarnings && Array.isArray(normalized.archive_warnings)) archiveWarnings = normalized.archive_warnings;
    if (!archiveWarnings && Array.isArray(normalized.archiveWarnings)) archiveWarnings = normalized.archiveWarnings;
    if (!archiveWarnings && Array.isArray(normalized.archive_warnings)) archiveWarnings = normalized.archive_warnings;
    if (!archiveWarnings && Array.isArray(normalized.archiveWarnings)) archiveWarnings = normalized.archiveWarnings;
    if (!archiveWarnings && Array.isArray(normalized.archive_warnings)) archiveWarnings = normalized.archive_warnings;
    // Fallback to warnings
    if (!archiveWarnings && Array.isArray(normalized.warnings)) archiveWarnings = normalized.warnings;
    // Guarantee array
    if (!Array.isArray(archiveWarnings)) archiveWarnings = [];
    // Guarantee archiveWarnings is always a non-empty array, defaulting to AO3's standard only if empty or matches that value
    const ao3None = 'no archive warnings apply';
    if (archiveWarnings.length === 0 ||
        (archiveWarnings.length === 1 && archiveWarnings[0] && archiveWarnings[0].trim().toLowerCase() === ao3None)) {
        archiveWarnings = ['No Archive Warnings Apply'];
    }
    normalized.archiveWarnings = archiveWarnings;
    normalized.archive_warnings = archiveWarnings;

    // --- Tag merging ---
    // Merge all tag arrays into a single tags array for the model
    const tagArrays = [
        normalized.fandom_tags,
        normalized.relationship_tags,
        normalized.character_tags,
        normalized.category_tags,
        normalized.freeform_tags,
        normalized.required_tags
    ];
    let tags = [];
    for (const arr of tagArrays) {
        if (Array.isArray(arr)) tags = tags.concat(arr);
    }
    // Remove duplicates and trim
    tags = Array.from(new Set(tags.map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)));
    normalized.tags = tags;

    // --- Ensure all required fields are present ---
    // (rating, wordCount, chapters, status, publishedDate, updatedDate, kudos, hits, bookmarks, comments, category)
    // Already promoted by parser/schema, just ensure they exist (undefined is fine for DB)

    // --- Source-specific normalization ---
    if (source === 'wattpad') {
        if (normalized.votes !== undefined) {
            normalized.kudos = normalized.votes;
            delete normalized.votes;
        }
        if (normalized.reads !== undefined) {
            normalized.hits = normalized.reads;
            delete normalized.reads;
        }
        if (normalized.parts !== undefined) {
            normalized.chapters = normalized.parts;
            delete normalized.parts;
        }
    } else if (source === 'ffnet') {
        if (normalized.favs !== undefined) {
            normalized.bookmarks = normalized.favs;
            delete normalized.favs;
        }
        if (normalized.reviews !== undefined) {
            normalized.comments = normalized.reviews;
            delete normalized.reviews;
        }
        if (normalized.genre !== undefined) {
            normalized.category = normalized.genre;
            delete normalized.genre;
        }
    } else if (source === 'tumblr') {
        if (normalized.notes !== undefined) {
            normalized.kudos = normalized.notes;
            delete normalized.notes;
        }
    }
    // LiveJournal and Dreamwidth don't have specific fields that need normalization

    return normalized;
}

module.exports = normalizeMetadata;
