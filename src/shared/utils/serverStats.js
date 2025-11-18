const { EmbedBuilder } = require('discord.js');
const { getZodiacSign, getChineseZodiacSign } = require('./zodiacCalculator'); // already correct, no change needed

/**
 * Formats timezone info for the profile card. If it spits out nonsense, well, timezones are chaos.
 * @param {string} timezone - User's timezone (or whatever they claim it is)
 * @param {string} timezoneDisplay - How fancy do you want it? ('iana', 'abbrev', 'hidden')
 * @returns {string|null} Formatted timezone string or null if hidden (privacy and all that)
 */
function formatTimezoneForProfile(timezone, timezoneDisplay = 'iana') {
    if (timezoneDisplay === 'hidden') {
        return null;
    }

    try {
        const now = new Date();
        let timezoneDisplayText;

        if (timezoneDisplay === 'short') {
            // Show abbreviated format. If this breaks, just show whatever comes out.
            try {
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                });
                timezoneDisplayText = timeInTimezone;
            } catch (error) {
                // Fallback to stored value if timezone is invalid. Because, yeah, it happens.
                timezoneDisplayText = timezone;
            }
        } else if (timezoneDisplay === 'offset') {
            // Show UTC offset only. If this fails, just give up and show the raw value.
            try {
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Calculate offset using a simple method. If it’s wrong, blame JavaScript.
                const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
                const timezoneTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
                const offsetMs = timezoneTime.getTime() - utcTime.getTime();
                const offsetHours = Math.floor(offsetMs / (1000 * 60 * 60));
                const offsetMins = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));
                const sign = offsetHours >= 0 ? '+' : '-';
                const absHours = Math.abs(offsetHours);
                timezoneDisplayText = `${timeInTimezone} (UTC${sign}${absHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')})`;
            } catch (error) {
                // Fallback to stored value if timezone is invalid. Again, not surprised.
                timezoneDisplayText = timezone;
            }
        } else if (timezoneDisplay === 'combined') {
            // Show both short timezone name and UTC offset.
            try {
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                });
                // Extract short timezone name (e.g., PST, EST)
                const parts = timeInTimezone.split(' ');
                const timezoneName = parts[parts.length - 1];
                const timeOnly = parts.slice(0, -1).join(' ');
                // Calculate UTC offset
                const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
                const timezoneTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
                const offsetMs = timezoneTime.getTime() - utcTime.getTime();
                const offsetHours = Math.floor(offsetMs / (1000 * 60 * 60));
                const offsetMins = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));
                const sign = offsetHours >= 0 ? '+' : '-';
                const absHours = Math.abs(offsetHours);
                const offsetString = `UTC${sign}${absHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;
                timezoneDisplayText = `${timezoneName} (${offsetString})`;
            } catch (error) {
                timezoneDisplayText = timezone;
            }
        }
        return timezoneDisplayText;
    } catch (error) {
        // Defensive: fallback to raw timezone value on error
        return timezone;
    }
}

/**
 * Birthday formatter for server stats. Not fancy, but it works.
 * @param {string} birthday - Birthday in YYYY-MM-DD format
 * @param {string} timezone - User's timezone (optional)
 * @returns {string} Formatted birthday string
 */
function formatBirthdayForStats(birthday, timezone) {
    if (!birthday) return 'Not set';

    const [year, month, day] = birthday.split('-').map(Number);
    const displayDate = new Date(year, month - 1, day);
    const monthName = displayDate.toLocaleDateString('en-US', { month: 'long' });

    // Get day with ordinal suffix (1st, 2nd, etc.)
    function getDayWithSuffix(day) {
        if (day >= 11 && day <= 13) return day + 'th';
        switch (day % 10) {
            case 1: return day + 'st';
            case 2: return day + 'nd';
            case 3: return day + 'rd';
            default: return day + 'th';
        }
    }

    return `${monthName} ${getDayWithSuffix(day)}`;
}

/**
 * Generate server stats for user profiles. Tries to be helpful.
 * @param {Object} discordUser - Discord user object
 * @param {Object} dbUser - Database user object
 * @param {Object} client - Discord client
 * @param {Object} interaction - Discord interaction (for getting member info)
 * @returns {Object} Stats fields organized by rows
 */
async function generateServerStats(discordUser, dbUser, client, interaction = null) {
    try {
        const guild = interaction ? interaction.guild : null;
        if (!guild) {
            return { row2Fields: [], row3Fields: [], row4Fields: [], row6Fields: [], hasStats: false };
        }

        let member;
        try {
            member = await guild.members.fetch(discordUser.id);
        } catch (error) {
            return { row2Fields: [], row3Fields: [], row4Fields: [], row6Fields: [], hasStats: false };
        }
        const row2Fields = [];
        const row3Fields = [];
        const row4Fields = [];
        const row6Fields = [];
    // Server join date with breakdown and PB-versary
        if (member.joinedAt) {
            const joinDate = member.joinedAt;
            const now = new Date();
            // Calculate time since joining (years, months, days)
            let years = now.getFullYear() - joinDate.getFullYear();
            let months = now.getMonth() - joinDate.getMonth();
            let days = now.getDate() - joinDate.getDate();
            // Adjust for negative days (calendar math is fun)
            if (days < 0) {
                months--;
                const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                days += lastMonth.getDate();
            }
            // Adjust for negative months (still fun)
            if (months < 0) {
                years--;
                months += 12;
            }
            // Format the time since joining (y/mo/d)
            let timeSinceJoining = '';
            if (years > 0) {
                timeSinceJoining += `${years}y`;
                if (months > 0 || days > 0) timeSinceJoining += ', ';
            }
            if (months > 0) {
                timeSinceJoining += `${months}mo`;
                if (days > 0) timeSinceJoining += ', ';
            }
            if (days > 0 || timeSinceJoining === '') {
                timeSinceJoining += `${days}d`;
            }
            // Calculate next PB-versary (how long until cake?)
            const isPBversaryToday = now.getMonth() === joinDate.getMonth() && now.getDate() === joinDate.getDate();
            let pbversaryText = '';
            if (isPBversaryToday) {
                pbversaryText = '🎂 **PB-versary is TODAY!**';
            } else {
                const nextPBversary = new Date(now.getFullYear(), joinDate.getMonth(), joinDate.getDate());
                if (nextPBversary < now) {
                    nextPBversary.setFullYear(now.getFullYear() + 1);
                }
                const msUntilPBversary = nextPBversary - now;
                // Calculate months and days until PB-versary
                let tempDate = new Date(now);
                let monthsUntil = 0;
                let daysUntil = 0;
                // Count full months (calendar shenanigans)
                while (tempDate.getFullYear() < nextPBversary.getFullYear() ||
                       (tempDate.getFullYear() === nextPBversary.getFullYear() && tempDate.getMonth() < nextPBversary.getMonth())) {
                    tempDate.setMonth(tempDate.getMonth() + 1);
                    monthsUntil++;
                }
                // Calculate remaining days (almost there)
                daysUntil = Math.ceil((nextPBversary - tempDate) / (24 * 60 * 60 * 1000));
                // Format the relative time (mo/d)
                if (monthsUntil > 0 && daysUntil > 0) {
                    pbversaryText = `PB-versary in ${monthsUntil}mo, ${daysUntil}d`;
                } else if (monthsUntil > 0) {
                    pbversaryText = `PB-versary in ${monthsUntil}mo`;
                } else if (daysUntil > 7) {
                    pbversaryText = `PB-versary in ${daysUntil}d`;
                } else {
                    pbversaryText = `🎂 PB-versary in ${daysUntil}d`;
                }
            }
            const joinDateFormatted = joinDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            row2Fields.push({
                name: 'Joined PB',
                value: `${joinDateFormatted}\n*${timeSinceJoining} ago*\n${pbversaryText}`,
                inline: true
            });
        }
    // Server roles (excluding @everyone, obviously)
        const roles = member.roles.cache
            .filter(role => role.name !== '@everyone')
            .sort((a, b) => b.position - a.position);
        if (roles.size > 0) {
            const roleArray = Array.from(roles.values()).slice(0, 3); // Top 3 roles only
            const roleList = roleArray.map(role => role.name).join(', ');
            const extraRoles = roles.size - roleArray.length;
            const roleText = extraRoles > 0 ? `${roleList} +${extraRoles} more` : roleList; // If you have more, congrats
            row2Fields.push({
                name: 'Server Roles',
                value: roleText,
                inline: true
            });
        } else {
            row2Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // Message count (third field in Row 2)
        if (dbUser.messageCount > 0) {
            let messageValue = `${dbUser.messageCount.toLocaleString()}`;
            // If admin has set the count, do not show 'since' date
            if (!dbUser.messageCountSetBy) {
                if (dbUser.messageCountStartDate) {
                    // Auto-tracked count - show since when tracking started
                    const startDate = new Date(dbUser.messageCountStartDate);
                    const formattedDate = startDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                    messageValue += `\n*Since ${formattedDate}*`;
                } else {
                    // Fallback for users without start date (legacy stuff)
                    messageValue += '\n*Since Nov 1, 2025*';
                }
            }
            row2Fields.push({
                name: 'Messages Sent',
                value: messageValue,
                inline: true
            });
        } else {
            row2Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // ROW 3 FIELDS: Birthday > Zodiac Sign > Chinese Zodiac (the fun stuff)
    // Birthday (only if set and not hidden)
        if (dbUser.birthday && !dbUser.birthdayHidden) {
            row3Fields.push({
                name: 'Birthday',
                value: formatBirthdayForStats(dbUser.birthday, dbUser.timezone),
                inline: true
            });
        } else {
            row3Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // Zodiac Sign (calculated from birthday)
        if (dbUser.birthday) {
            const [year, month, day] = dbUser.birthday.split('-').map(Number);
            row3Fields.push({
                name: 'Zodiac Sign',
                value: getZodiacSign(month, day),
                inline: true
            });
        } else {
            row3Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // Chinese Zodiac (calculated from birthday year)
        if (dbUser.birthday && !dbUser.birthdayYearHidden) {
            const [year, month, day] = dbUser.birthday.split('-').map(Number);
            // Only show Chinese zodiac if a real year was provided (not a placeholder like 1900)
            // If you see 1900, it's a privacy thing.
            if (year >= 1920 && year <= new Date().getFullYear()) {
                row3Fields.push({
                    name: 'Chinese Zodiac',
                    value: getChineseZodiacSign(year),
                    inline: true
                });
            } else {
                // Hidden for privacy (no year provided)
                row3Fields.push({ name: '\u200B', value: '\u200B', inline: true });
            }
        } else {
            row3Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // ROW 4 FIELDS: Timezone > Pronouns > Age (the basics)
        // Timezone
        if (dbUser.timezone) {
            console.log(`Timezone Debug: User ${dbUser.discordId} has timezone="${dbUser.timezone}" timezoneDisplay="${dbUser.timezoneDisplay}"`);
            const formattedTimezone = formatTimezoneForProfile(dbUser.timezone, dbUser.timezoneDisplay);
            console.log(`Timezone Debug: formatTimezoneForProfile returned: ${formattedTimezone ? `"${formattedTimezone}"` : 'null'}`);
            if (formattedTimezone) {
                // Simple timezone display - just time and timezone, plus user's custom region if set
                let timezoneInfo = formattedTimezone;
                // Add user's custom region if they've set one and regionDisplay is enabled (fancy)
                if (dbUser.region && dbUser.regionDisplay !== false) {
                    timezoneInfo += `\n*${dbUser.region}*`;
                }
                row4Fields.push({
                    name: 'Timezone',
                    value: timezoneInfo,
                    inline: true
                });
            } else {
                // Hidden timezone - show region as separate field if regionDisplay is enabled (privacy mode)
                if (dbUser.region && dbUser.regionDisplay !== false) {
                    row4Fields.push({
                        name: 'Region',
                        value: `*${dbUser.region}*`,
                        inline: true
                    });
                } else {
                    row4Fields.push({ name: '\u200B', value: '\u200B', inline: true });
                }
            }
        } else if (dbUser.region && dbUser.regionDisplay !== false) {
            // No timezone set, but region is set and regionDisplay is enabled (better than nothing)
            row4Fields.push({
                name: 'Region',
                value: `*${dbUser.region}*`,
                inline: true
            });
        } else {
            row4Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // Pronouns (if set)
        if (dbUser.pronouns) {
            row4Fields.push({
                name: 'Pronouns',
                value: dbUser.pronouns,
                inline: true
            });
        } else {
            row4Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // Age (calculated from birthday if available and year was provided, unless age is hidden)
        if (dbUser.birthday && !dbUser.birthdayAgePrivacy && !dbUser.birthdayYearHidden && !dbUser.birthdayAgeOnly) {
            // Parse birthday from YYYY-MM-DD format (classic)
            const [year, month, day] = dbUser.birthday.split('-').map(Number);

            // Only show age if a real year was provided (not a placeholder like 1900)
            // If you see 1900, it's a privacy thing.
            if (year >= 1920 && year <= new Date().getFullYear()) {
                const birthDate = new Date(year, month - 1, day); // month is 0-indexed
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                row4Fields.push({
                    name: 'Age',
                    value: `${age} years old`,
                    inline: true
                });
            } else {
                // Year not provided or privacy mode, show empty field (respect privacy)
                row4Fields.push({ name: '\u200B', value: '\u200B', inline: true });
            }
        } else {
            row4Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    // Last activity (when did they last show up?)
        if (dbUser.lastSeen) {
            const lastSeen = new Date(dbUser.lastSeen);
            const timeSinceLastSeen = Date.now() - lastSeen.getTime();
            let lastSeenText;
            if (timeSinceLastSeen < 60000) { // Less than 1 minute
                lastSeenText = 'Just now';
            } else if (timeSinceLastSeen < 3600000) { // Less than 1 hour
                const minutes = Math.floor(timeSinceLastSeen / 60000);
                lastSeenText = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
            } else if (timeSinceLastSeen < 86400000) { // Less than 1 day
                const hours = Math.floor(timeSinceLastSeen / 3600000);
                lastSeenText = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
            } else if (timeSinceLastSeen < 2592000000) { // Less than 30 days
                const days = Math.floor(timeSinceLastSeen / 86400000);
                lastSeenText = `${days} day${days !== 1 ? 's' : ''} ago`;
            } else {
                lastSeenText = lastSeen.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }
            row6Fields.push({
                name: 'Last Seen',
                value: lastSeenText,
                inline: true
            });
        }
    // Status (Online/Idle/DND/Offline)
        let statusText = 'Offline';
        let statusEmoji = '⚫';
        if (member.presence) {
            switch (member.presence.status) {
                case 'online':
                    statusText = 'Online';
                    statusEmoji = '🟢';
                    break;
                case 'idle':
                    statusText = 'Idle';
                    statusEmoji = '🟡';
                    break;
                case 'dnd':
                    statusText = 'Do Not Disturb';
                    statusEmoji = '🔴';
                    break;
                default:
                    statusText = 'Offline';
                    statusEmoji = '⚫';
            }
        }
        row6Fields.push({
            name: 'Status',
            value: `${statusEmoji} ${statusText}`,
            inline: true
        });
    // Server boost status (only show if actively boosting)
        if (member.premiumSince) {
            row6Fields.push({
                name: 'Server Booster',
                value: '💎 Active',
                inline: true
            });
        }
    // Pad row6Fields with empty fields if needed (Discord embed rules)
        while (row6Fields.length < 3) {
            row6Fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
        return {
            row2Fields,
            row3Fields,
            row4Fields,
            row6Fields,
            hasStats: true
        };
    } catch (error) {
        // Defensive: log and return empty stats on error
        console.error('Error generating server stats:', error);
        return { row2Fields: [], row3Fields: [], row4Fields: [], row6Fields: [], hasStats: false };
    }
}

module.exports = {
    generateServerStats,
    formatTimezoneForProfile,
    formatBirthdayForStats
};