// AO3 tag color palette utility
// These are the default tag highlight colors as seen on AO3 (approximate)
// Order: yellow, orange, red, purple, blue, teal, green, gold, pink, gray

const ao3TagColors = [
    '#ffe066', // yellow
    '#ffb366', // orange
    '#ff6666', // red
    '#b366ff', // purple
    '#66b3ff', // blue
    '#66ffb3', // teal
    '#b3ff66', // green
    '#ffd966', // gold
    '#ff66b3', // pink
    '#a3a3a3'  // gray
];

// AO3 rating colors (from AO3 CSS and community sources)
export const ao3RatingColors = {
    'general audiences': '#81c784', // green (approx. .rating-general)
    'teen and up audiences': '#ffd54f', // yellow (approx. .rating-teen)
    'mature': '#ffb74d', // orange (approx. .rating-mature)
    'explicit': '#e57373', // red (approx. .rating-explicit)
    'not rated': '#b0bec5' // gray (approx. .rating-notrated)
};

/**
 * Get AO3 rating color by normalized rating string
 * @param {string} rating
 * @returns {string} Hex color string
 */
export function getAo3RatingColor(rating) {
    return ao3RatingColors[rating] || ao3RatingColors['not rated'];
}

/**
 * Get AO3 tag color by index (wraps around if more tags than colors)
 * @param {number} i
 * @param {number} [alpha=1] - Alpha as 0..1, returns rgba if < 1
 * @returns {string} Hex or rgba color string
 */
export function getAo3TagColor(i, alpha = 1) {
    const hex = ao3TagColors[i % ao3TagColors.length];
    if (alpha >= 1) return hex;
    // Convert hex to rgba
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

export default ao3TagColors;
