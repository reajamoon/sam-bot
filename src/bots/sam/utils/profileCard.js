const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User } = require('../../../models');
const { formatBirthdayForProfile } = require('./birthdayFormatter');
const { getZodiacSign, getChineseZodiacSign } = require('../../../shared/utils/zodiacCalculator');
const { generateServerStats } = require('../../../shared/utils/serverStats');
const { buildPrivacySettingsCustomId } = require('../../../shared/utils/messageTracking');

/**
 * Profile card generation and user management utilities
 */

/**
 * Format timezone information for profile display
 * @param {string} timezone - User's timezone
 * @param {string} timezoneDisplay - Display preference (iana, abbrev, hidden)
 * @returns {string|null} Formatted timezone string or null if hidden
 */
function formatTimezoneForProfile(timezone, timezoneDisplay = 'iana') {
    if (timezoneDisplay === 'hidden') {
        return null;
    }

    try {
        const now = new Date();
        let timezoneDisplayText;

        if (timezoneDisplay === 'short') {
            // Show abbreviated format
            try {
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                });
                timezoneDisplayText = timeInTimezone;
            } catch (error) {
                // Fallback to stored value if timezone is invalid
                timezoneDisplayText = timezone;
            }
        } else if (timezoneDisplay === 'offset') {
            // Show UTC offset only
            try {
                const offsetMinutes = now.getTimezoneOffset();
                const sign = offsetMinutes > 0 ? '-' : '+';
                const hours = Math.floor(Math.abs(offsetMinutes) / 60);
                const minutes = Math.abs(offsetMinutes) % 60;
                const offsetString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                timezoneDisplayText = `UTC${sign}${offsetString}\n${timeInTimezone}`;
            } catch (error) {
                // Fallback to stored value if timezone is invalid
                timezoneDisplayText = timezone;
            }
        } else if (timezoneDisplay === 'combined') {
            // Show combined offset and name
            try {
                const offsetMinutes = now.getTimezoneOffset();
                const sign = offsetMinutes > 0 ? '-' : '+';
                const hours = Math.floor(Math.abs(offsetMinutes) / 60);
                const minutes = Math.abs(offsetMinutes) % 60;
                const offsetString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // Get timezone long name for display
                const timezoneLongName = timezone.split('/').pop().replace(/_/g, ' ');
                timezoneDisplayText = `(UTC${sign}${offsetString}) ${timezoneLongName}\n${timeInTimezone}`;
            } catch (error) {
                // Fallback to stored value if timezone is invalid
                timezoneDisplayText = timezone;
            }
        } else {
            // Default: show full IANA name
            try {
                const timeInTimezone = now.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                timezoneDisplayText = `${timezone}\n${timeInTimezone}`;
            } catch (error) {
                // Invalid timezone, just show the stored value
                timezoneDisplayText = timezone;
            }
        }

        return timezoneDisplayText;
    } catch (error) {
        // If any error occurs, just show the stored timezone value
        return timezone;
    }
}

/**
 * Get or create user in database with updated info
 * @param {Object} discordUser - Discord user object
 * @returns {Promise<Object>} User database object
 */
async function getOrCreateUser(discordUser) {
    let [user, created] = await User.findOrCreate({
        where: { discordId: discordUser.id },
        defaults: {
            discordId: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar
        }
    });

    if (!created) {
        // Update user info if it changed
        await user.update({
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar,
            lastSeen: new Date()
        });
    }

    return user;
}

/**
 * Generate complete profile embed with all fields
 * @param {Object} discordUser - Discord user object
 * @param {Object} dbUser - Database user object
 * @param {Object} client - Discord client for footer icon
 * @returns {Object} Profile embed and components
 */
async function generateProfileCard(discordUser, dbUser, client = null, interaction = null) {
    const fields = [];

    // Row 1: Username > User ID > Account Created
    fields.push(
        { name: 'Username', value: discordUser.username, inline: true },
        { name: 'User ID', value: discordUser.id, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(discordUser.createdTimestamp / 1000)}:R>`, inline: true }
    );

    // Get server stats for all rows
    const serverStats = await generateServerStats(discordUser, dbUser, client, interaction);
    // Add Row 2: Joined Profound Bond > Server Roles > Messages Sent
    if (serverStats.row2Fields) {
        fields.push(...serverStats.row2Fields);
    }
    // Add Row 3: Birthday > Zodiac Sign > Chinese Zodiac
    if (serverStats.row3Fields) {
        fields.push(...serverStats.row3Fields);
    }
    // Add Row 4: Timezone > Pronouns > Age
    if (serverStats.row4Fields) {
        fields.push(...serverStats.row4Fields);
    }
    // Row 5: Bio (full width)
    if (dbUser.bio) {
        fields.push({ name: 'Bio', value: dbUser.bio, inline: false });
    }
    // Row 6: Last Seen > Status > Booster
    if (serverStats.row6Fields) {
        fields.push(...serverStats.row6Fields);
    }
    // Determine display name (server nickname if available, otherwise username)
    let displayName = discordUser.username;
    let member = null;
    if (interaction && interaction.guild) {
        try {
            member = await interaction.guild.members.fetch(discordUser.id);
            if (member && member.nickname) {
                displayName = member.nickname;
            }
        } catch (error) {
            // If we can't fetch member info, just use username
            console.log('Could not fetch member info for nickname, using username');
        }
    }

    // Use member color if available, otherwise fallback to Discord blurple
    const embedColor = (member && member.displayHexColor && member.displayHexColor !== '#000000')
        ? member.displayHexColor
        : 0x5865F2;

    // Create the embed
    const embed = new EmbedBuilder()
        .setTitle(`${displayName}'s Profile`)
        .setThumbnail(discordUser.displayAvatarURL({ dynamic: true }))
        .setColor(embedColor)
        .setFields(fields)
        .setTimestamp()
        .setFooter({
            text: 'Sam\'s Hunter Network • The Family Business',
            iconURL: client ? client.user.displayAvatarURL() : undefined
        });

    return { embed, fields };
}

/**
 * Create profile action buttons
 * @param {string} viewerId - ID of user viewing the profile
 * @param {string} profileOwnerId - ID of profile owner
 * @param {string} messageId - ID of the profile message for tracking (optional)
 * @returns {Array<ActionRowBuilder>} Array of button rows
 */
function createProfileButtons(viewerId, profileOwnerId, messageId = null) {
    const rows = [];

    // Show edit buttons only for your own profile
    if (viewerId === profileOwnerId) {
        // Build privacy settings custom ID with message tracking if available
        const privacyCustomId = messageId
            ? buildPrivacySettingsCustomId(profileOwnerId, messageId)
            : `privacy_settings_${profileOwnerId}`;

        // Build profile settings custom ID with message tracking if available
        const profileSettingsCustomId = messageId
            ? `profile_settings_${profileOwnerId}_${messageId}`
            : `profile_settings_${profileOwnerId}`;

        // Single row with three main categories
        const mainRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(profileSettingsCustomId)
                    .setLabel('Profile Settings')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚙️'),
                new ButtonBuilder()
                    .setCustomId(privacyCustomId)
                    .setLabel('Privacy Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('profile_help')
                    .setLabel('Help')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❓')
            );

        rows.push(mainRow);
    } else {
        // Just help button for viewing others' profiles
        const helpRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_help')
                    .setLabel('Help')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❓')
            );
        rows.push(helpRow);
    }

    return rows;
}

/**
 * Check if profile is accessible to viewer
 * @param {Object} dbUser - Database user object
 * @param {string} viewerId - ID of user viewing profile
 * @param {string} profileOwnerId - ID of profile owner
 * @returns {boolean} Whether profile can be viewed
 */
function canViewProfile(dbUser, viewerId, profileOwnerId) {
    // Always can view your own profile
    if (viewerId === profileOwnerId) {
        return true;
    }
    // Check if profile is blocked
    return !dbUser.profileBlocked;
}

module.exports = {
    getOrCreateUser,
    generateProfileCard,
    createProfileButtons,
    canViewProfile
};