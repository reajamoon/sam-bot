import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { buildModalCustomId } from '../../../../shared/utils/messageTracking.js';

/**
 * Handler for the set timezone button, shows the timezone modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleTimezone(interaction) {
    // Extract userId and messageId if this is from tracked profile settings
    const parts = interaction.customId.split('_');
    const targetUserId = parts.length >= 3 ? parts[2] : interaction.user.id;
    const originalMessageId = parts.length >= 4 ? parts[3] : null;
    // Build modal custom ID with message tracking if available
    const modalCustomId = buildModalCustomId('timezone', originalMessageId);

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Timezone');

    const timezoneInput = new TextInputBuilder()
        .setCustomId('timezone_input')
        .setLabel('Timezone (City, UTC offset, or abbreviation)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Examples: New York, UTC-5, EST, Los Angeles')
        .setRequired(true)
        .setMaxLength(50);

    const firstActionRow = new ActionRowBuilder().addComponents(timezoneInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
