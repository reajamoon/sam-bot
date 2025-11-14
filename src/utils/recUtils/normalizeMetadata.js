
const AO3_FIELD_MAP = require('./ao3/ao3FieldMap');

function normalizeMetadata(metadata, source) {
    const normalized = {};

    // Map AO3 fields to internal fields using the field map
    for (const [ao3Key, value] of Object.entries(metadata)) {
        const internalKey = AO3_FIELD_MAP[ao3Key] || ao3Key;
        if (Array.isArray(value)) {
            normalized[internalKey] = value;
        } else {
            normalized[internalKey] = value;
        }
    }

    // Guarantee all tag arrays are present and are arrays
    normalized.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
    normalized.fandom_tags = Array.isArray(normalized.fandom_tags) ? normalized.fandom_tags : [];
    normalized.character_tags = Array.isArray(normalized.character_tags) ? normalized.character_tags : [];
    normalized.archive_warnings = Array.isArray(normalized.archive_warnings) ? normalized.archive_warnings : [];

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
    let archiveWarnings = normalized.archiveWarnings || normalized.archive_warnings;
    if (!Array.isArray(archiveWarnings)) archiveWarnings = [];
    const ao3None = 'no archive warnings apply';
    if (archiveWarnings.length === 0 ||
        (archiveWarnings.length === 1 && archiveWarnings[0] && archiveWarnings[0].trim().toLowerCase() === ao3None)) {
        archiveWarnings = ['No Archive Warnings Apply'];
    }
    normalized.archiveWarnings = archiveWarnings;
    normalized.archive_warnings = archiveWarnings;

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
