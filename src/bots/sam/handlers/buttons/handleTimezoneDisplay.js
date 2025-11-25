import { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { buildButtonId } from '../../../../shared/utils/buttonId.js';

/**
 * Handler for showing the timezone display preference menu.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleTimezoneDisplay(interaction) {
    // Extract profile owner ID if present (new format)
    const profileOwnerId = interaction.customId.includes('_') ? interaction.customId.split('_')[2] : null;
    // Show timezone display preference menu
    const menuParts = interaction.customId.split('_');
    const messageId = menuParts.length >= 4 ? menuParts[3] : '';
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
    // Use centralized builder for Back to Profile Settings button
    const backButtonCustomId = await buildButtonId({
        action: 'back_to_profile_settings',
        context: 'profile_settings',
        primaryId: interaction.user.id,
        secondaryId: messageId || ''
    });
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
