/**
 * Normalizes metadata field names to AO3 terminology
 * @param {Object} metadata - The metadata object to normalize
 * @param {string} source - The source site (e.g., 'wattpad', 'ffnet', 'tumblr')
 * @returns {Object} - Normalized metadata object
 */
function normalizeMetadata(metadata, source) {
    const normalized = { ...metadata };
    // Normalize rating to AO3 canonical names for non-AO3 sources
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

    // Normalize warnings: always use archiveWarnings (array) for major content warnings
    if (normalized.warnings && !normalized.archiveWarnings) {
        if (Array.isArray(normalized.warnings)) {
            normalized.archiveWarnings = normalized.warnings;
        } else if (typeof normalized.warnings === 'string') {
            normalized.archiveWarnings = normalized.warnings.split(',').map(w => w.trim()).filter(Boolean);
        } else {
            normalized.archiveWarnings = [String(normalized.warnings)];
        }
        delete normalized.warnings;
    }
    // Remove any legacy archiveWarning field
    if (normalized.archiveWarning) delete normalized.archiveWarning;
    // Guarantee archiveWarnings is always a non-empty array, defaulting to AO3's standard only if empty or matches that value
    const ao3None = 'no archive warnings apply';
    if (!Array.isArray(normalized.archiveWarnings) || normalized.archiveWarnings.length === 0 ||
        (normalized.archiveWarnings.length === 1 && normalized.archiveWarnings[0] && normalized.archiveWarnings[0].trim().toLowerCase() === ao3None)) {
        normalized.archiveWarnings = ['No Archive Warnings Apply'];
    }
    console.log('[NORMALIZE] archiveWarnings after normalization:', normalized.archiveWarnings);
    if (source === 'wattpad') {
        // Wattpad normalization
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
        // FFNet normalization
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
        // Tumblr normalization
        if (normalized.notes !== undefined) {
            normalized.kudos = normalized.notes;
            delete normalized.notes;
        }
    }
    // LiveJournal and Dreamwidth don't have specific fields that need normalization
    return normalized;
}

module.exports = normalizeMetadata;
