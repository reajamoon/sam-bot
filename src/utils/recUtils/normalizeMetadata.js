/**
 * Normalizes metadata field names to AO3 terminology
 * @param {Object} metadata - The metadata object to normalize
 * @param {string} source - The source site (e.g., 'wattpad', 'ffnet', 'tumblr')
 * @returns {Object} - Normalized metadata object
 */
function normalizeMetadata(metadata, source) {
    const normalized = { ...metadata };
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
