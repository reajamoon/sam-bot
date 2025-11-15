const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildButtonId } = require('../../../../../shared/utils/buttonId');

async function handleTimezoneDisplay(interaction) {
    const { getProfileMessageId, buildProfileButtonId } = require('../../../../../shared/utils/messageTracking');
    const messageId = getProfileMessageId(interaction, interaction.customId);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`timezone_display_select_${messageId}`)
        .setPlaceholder('Choose how to display your timezone')
        .addOptions([
            {
                label: 'Full Name (America/New_York)',
                description: 'Show the complete IANA timezone name',
                value: 'iana',
                emoji: '🌍'
            },
            {
                label: 'UTC Offset (UTC-5)',
                description: 'Show as UTC offset from Greenwich',
                value: 'offset',
                emoji: '⏰'
            },
            {
                label: 'Short Code (EST)',
                description: 'Show just the timezone abbreviation',
                value: 'short',
                emoji: '🏷️'
            },
            {
                label: 'Combined (UTC-08:00) Pacific Time',
                description: 'Show offset and readable name together',
                value: 'combined',
                emoji: '🕐'
            },
            {
                label: 'Hidden',
                description: 'Don\'t show timezone on your profile',
                value: 'hidden',
                emoji: '🚫'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const backButtonCustomId = buildProfileButtonId('back_to_profile_settings', 'profile_settings', interaction.user.id, messageId);
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(backButtonCustomId)
                .setLabel('← Back to Profile Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
        );

    await interaction.update({
        content: '⚙️ **Timezone Display Preferences**\nChoose how you want your timezone to appear on your profile:',
        components: [row, backButton],
        embeds: []
    });
}

module.exports = { handleTimezoneDisplay };
