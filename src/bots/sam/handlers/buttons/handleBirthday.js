import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

/**
 * Handler for the set birthday button, shows the birthday modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleBirthday(interaction) {
    // Extract userId and messageId if this is from tracked profile settings
    const parts = interaction.customId.split('_');
    const targetUserId = parts.length >= 3 ? parts[2] : interaction.user.id;
    const originalMessageId = parts.length >= 4 ? parts[3] : null;
    // Build modal custom ID with message tracking if available
    const modalCustomId = originalMessageId ? `birthday_modal_${originalMessageId}` : 'birthday_modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Birthday');

    const birthdayInput = new TextInputBuilder()
        .setCustomId('birthday_input')
        .setLabel('Birthday (MM/DD or MM/DD/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Examples: 12/25, 12/25/1995, or 12/25/95')
        .setRequired(true)
        .setMaxLength(10);

    const firstActionRow = new ActionRowBuilder().addComponents(birthdayInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
