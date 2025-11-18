/**
 * Birthday formatting and display utilities
 */

/**
 * Get day with ordinal suffix (1st, 2nd, 3rd, etc.)
 * @param {number} day - Day of month
 * @returns {string} Day with suffix
 */
function getDayWithSuffix(day) {
    if (day >= 11 && day <= 13) {
        return day + 'th';
    }
    switch (day % 10) {
        case 1: return day + 'st';
        case 2: return day + 'nd';
        case 3: return day + 'rd';
        default: return day + 'th';
    }
}

/**
 * Format birthday data for profile display
 * @param {Object} user - User database object
 * @returns {Object} Formatted birthday fields for profile
 */
function formatBirthdayForProfile(user) {
    if (!user.birthday || user.birthdayHidden) {
        return { fields: [], hasZodiac: false };
    }

    const fields = [];
    let year, month, day;
    
    // Handle different birthday storage formats
    if (user.birthday.includes('/')) {
        // MM/DD/YYYY or MM/DD format
        const parts = user.birthday.split('/');
        if (parts.length === 3) {
            // MM/DD/YYYY
            month = parseInt(parts[0]);
            day = parseInt(parts[1]);
            year = parseInt(parts[2]);
        } else if (parts.length === 2) {
            // MM/DD (privacy mode)
            month = parseInt(parts[0]);
            day = parseInt(parts[1]);
            year = 1900; // Indicates privacy mode
        } else {
            return { fields: [], hasZodiac: false };
        }
    } else if (user.birthday.includes('-')) {
        // YYYY-MM-DD format
        const parts = user.birthday.split('-');
        if (parts.length === 3) {
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
        } else {
            return { fields: [], hasZodiac: false };
        }
    } else {
        return { fields: [], hasZodiac: false };
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Create birthday display text
    const displayDate = new Date(currentYear, month - 1, day);
    const monthName = displayDate.toLocaleDateString('en-US', { month: 'long' });
    const dayWithSuffix = getDayWithSuffix(day);
    let birthdayDisplayText = `${monthName} ${dayWithSuffix}`;
    
    // Calculate days until next birthday
    const thisYearBirthday = new Date(currentYear, month - 1, day);
    const nextYearBirthday = new Date(currentYear + 1, month - 1, day);
    const nextBirthday = thisYearBirthday >= today ? thisYearBirthday : nextYearBirthday;
    const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
    
    // Add birthday countdown emoji
    if (daysUntil === 0) {
        birthdayDisplayText += ' 🎉';
    } else if (daysUntil === 1) {
        birthdayDisplayText += ' 🎂 (Tomorrow!)';
    } else if (daysUntil <= 7) {
        birthdayDisplayText += ` 🎂 (In ${daysUntil} days)`;
    }
    
    fields.push({ name: 'Birthday', value: birthdayDisplayText, inline: true });
    
    // Add age if privacy allows and we have a valid birth year
    if (!user.birthdayAgePrivacy && year !== 1900 && year > 1900) {
        let age = currentYear - year;
        const hasHadBirthdayThisYear = today >= new Date(currentYear, month - 1, day);
        if (!hasHadBirthdayThisYear) {
            age--;
        }
        fields.push({ name: 'Age', value: age.toString(), inline: true });
    }
    
    return {
        fields,
        hasZodiac: true,
        zodiacData: { year, month, day },
        isPrivacyMode: year === 1900
    };
}

module.exports = {
    getDayWithSuffix,
    formatBirthdayForProfile
};