/**
 * Zodiac sign calculation utilities
 * Handles both Western and Chinese zodiac calculations
 */

/**
 * Calculate Western zodiac sign based on birth month and day
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day (1-31)
 * @returns {string} Zodiac sign with emoji
 */
function getZodiacSign(month, day) {
    const zodiacSigns = [
        { name: 'Aquarius', emoji: '♒', start: [1, 20], end: [2, 18] },
        { name: 'Pisces', emoji: '♓', start: [2, 19], end: [3, 20] },
        { name: 'Aries', emoji: '♈', start: [3, 21], end: [4, 19] },
        { name: 'Taurus', emoji: '♉', start: [4, 20], end: [5, 20] },
        { name: 'Gemini', emoji: '♊', start: [5, 21], end: [6, 20] },
        { name: 'Cancer', emoji: '♋', start: [6, 21], end: [7, 22] },
        { name: 'Leo', emoji: '♌', start: [7, 23], end: [8, 22] },
        { name: 'Virgo', emoji: '♍', start: [8, 23], end: [9, 22] },
        { name: 'Libra', emoji: '♎', start: [9, 23], end: [10, 22] },
        { name: 'Scorpio', emoji: '♏', start: [10, 23], end: [11, 21] },
        { name: 'Sagittarius', emoji: '♐', start: [11, 22], end: [12, 21] },
        { name: 'Capricorn', emoji: '♑', start: [12, 22], end: [1, 19] }
    ];

    for (const sign of zodiacSigns) {
        const [startMonth, startDay] = sign.start;
        const [endMonth, endDay] = sign.end;
        
        if (startMonth === endMonth) {
            // Sign doesn't cross year boundary
            if (month === startMonth && day >= startDay && day <= endDay) {
                return `${sign.emoji} ${sign.name}`;
            }
        } else {
            // Sign crosses year boundary (like Capricorn)
            if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
                return `${sign.emoji} ${sign.name}`;
            }
        }
    }
    
    return '❓ Unknown';
}

/**
 * Calculate Chinese zodiac sign based on birth year
 * @param {number} year - Birth year
 * @returns {string} Chinese zodiac animal with emoji
 */
function getChineseZodiacSign(year) {
    const animals = [
        { name: 'Rat', emoji: '🐀' },
        { name: 'Ox', emoji: '🐂' },
        { name: 'Tiger', emoji: '🐅' },
        { name: 'Rabbit', emoji: '🐇' },
        { name: 'Dragon', emoji: '🐉' },
        { name: 'Snake', emoji: '🐍' },
        { name: 'Horse', emoji: '🐎' },
        { name: 'Goat', emoji: '🐐' },
        { name: 'Monkey', emoji: '🐒' },
        { name: 'Rooster', emoji: '🐓' },
        { name: 'Dog', emoji: '🐕' },
        { name: 'Pig', emoji: '🐖' }
    ];
    
    // The Chinese zodiac follows a 12-year cycle starting from 1900 (Year of the Rat)
    const baseYear = 1900;
    const animalIndex = (year - baseYear) % 12;
    const animal = animals[animalIndex];
    
    return `${animal.emoji} ${animal.name}`;
}

module.exports = {
    getZodiacSign,
    getChineseZodiacSign
};