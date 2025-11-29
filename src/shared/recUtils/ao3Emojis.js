// AO3 Custom Emojis and Warning Logic

// Map AO3 normalized rating names to custom emoji
export const ratingEmojis = {
    'general audiences': '<:ratinggeneral:1133762158077935749>',
    'teen and up audiences': '<:ratingteen:1133762194174136390>',
    'mature': '<:ratingmature:1133762226738700390>',
    'explicit': '<:ratingexplicit:1133762272087506965>',
    'not rated': '❔',
    'unrated': '❔'
};

// Archive warning emoji and logic
export const majorWarningEmoji = '<:warn_yes:1142772202379415622>';
export const maybeWarningEmoji = '<:warn_maybe:1142772269156933733>';

export const majorWarningsList = [
    'Graphic Depictions of Violence',
    'Major Character Death',
    'Rape/Non-Con',
    'Underage',
    'Underage Sex'
];

/**
 * Format rating with appropriate emoji
 * @param {string} rating - AO3 rating string
 * @returns {string} Formatted rating with emoji
 */
export function formatRatingWithEmoji(rating) {
    if (!rating || typeof rating !== 'string') return '❔ Unrated';
    
    const key = rating.trim().toLowerCase();
    const emoji = ratingEmojis[key] || '❔';
    
    return `${emoji} ${rating}`;
}

/**
 * Format archive warnings with appropriate emoji
 * @param {Array} warnings - Array of archive warning strings
 * @returns {string|null} Formatted warning text with emoji, or null if no warnings
 */
export function formatArchiveWarnings(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) return null;
    
    // Filter and normalize warnings
    const filtered = warnings
        .map(w => typeof w === 'string' ? w.trim() : '')
        .filter(w => w && w.toLowerCase() !== 'no archive warnings apply');
    
    if (filtered.length === 0) return null;
    
    // Special case: Creator chose not to use warnings
    if (filtered.length === 1 && 
        filtered[0].toLowerCase() === 'creator chose not to use archive warnings') {
        return `${maybeWarningEmoji} Creator Chose Not To Use Archive Warnings`;
    }
    
    // Check if any warnings are major
    const hasMajor = filtered.some(warning =>
        majorWarningsList.some(majorWarning => 
            warning.toLowerCase().includes(majorWarning.toLowerCase())
        )
    );
    
    const emoji = hasMajor ? majorWarningEmoji : maybeWarningEmoji;
    return `${emoji} ${filtered.join(', ')}`;
}