const { EmbedBuilder } = require('discord.js');
const { createBirthdayHelp } = require('../../../utils/profileHelpBirthday');
const { createBioHelp } = require('../../../utils/profileHelpBio');
const { createPrivacyHelp } = require('../../../utils/profileHelpPrivacy');
const { createTipsHelp } = require('../../../utils/profileHelpTips');
const { createTimezoneRegionHelp } = require('../../../utils/profileHelpTimezoneRegion');
const { createHelpWithBackButton } = require('../../../utils/profileHelpButtons');

/**
 * Profile help system with category-based navigation
 */

/**
 * Create main profile help embed with category buttons
 * @returns {Object} Object with embed and component row
 */

function createProfileHelpMain(interaction) {
    // Main help menu embed is still constructed here, but all category help is loaded from modular files
    const embed = new EmbedBuilder()
        .setTitle('📚 Profile Help')
        .setDescription('Hey! Your profile shows your Discord info plus whatever you want to share. It’s organized into three main sections with buttons to make editing easy.')
        .addFields(
            { name: 'Profile Settings', value: 'Set your birthday, bio, timezone, region, and pronouns here. Change something, and I’ll update your profile. Straightforward enough.', inline: false },
            { name: 'Privacy Settings', value: "You decide what shows up on your profile—birthday mentions, age, region, all of it. If you want to keep something private, I’ll make sure it stays that way. You’re in control, not me.", inline: false },
            { name: 'Help', value: 'Detailed guides for every feature. If you’re reading this, you found it.', inline: false },
            { name: '\u200B', value: '**Need help with a specific feature?**', inline: false },
            { name: 'Birthday Stuff', value: 'Birthday wishes, zodiac signs, privacy controls.', inline: true },
            { name: 'Bio & Pronouns', value: 'Tell people about yourself and set up your pronouns.', inline: true },
            { name: 'Timezones', value: 'Show your local time. Flexible display options for the chronologically challenged.', inline: true },
            { name: 'Regions', value: 'Share your general region, location, country, city, whatever.', inline: true },
            { name: 'Privacy', value: 'Granular control over what others can see.', inline: true },
            { name: '\u200B', value: '\u200B', inline: true }
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Pick a category to learn more.' });

    const { encodeMessageId } = require('../../../shared/utils/messageTracking');
    const userId = interaction?.user?.id || '';
    const messageId = interaction?.message?.id || '';
    const encodedMsgId = encodeMessageId(messageId);
    return createHelpWithBackButton(embed, { user: { id: userId }, id: messageId, message: { id: messageId } });
}

/**
 * Create birthday help embed
 * @returns {Object} Object with embed and component row
 */

/**
 * Create bio help embed
 * @returns {Object} Object with embed and component row
 */

/**
 * Create privacy help embed
 * @returns {Object} Object with embed and component row
 */

/**
 * Create tips help embed
 * @returns {Object} Object with embed and component row
 */

/**
 * Helper function to create help embed with back buttons
 * @param {EmbedBuilder} embed - The embed to add buttons to
 * @returns {Object} Object with embed and component rows
 */



module.exports = {
    createProfileHelpMain,
    createBirthdayHelp,
    createBioHelp,
    createPrivacyHelp,
    createTipsHelp,
    createTimezoneRegionHelp,
    createHelpWithBackButton
};