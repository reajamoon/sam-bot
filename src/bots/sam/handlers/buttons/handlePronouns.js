import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

/**
 * Handler for the set pronouns button, shows the pronouns modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handlePronouns(interaction) {
    // Extract userId and messageId if this is from tracked profile settings
    const parts = interaction.customId.split('_');
    const targetUserId = parts.length >= 3 ? parts[2] : interaction.user.id;
    const originalMessageId = parts.length >= 4 ? parts[3] : null;
    // Build modal custom ID with message tracking if available
    const modalCustomId = originalMessageId ? `pronouns_modal_${originalMessageId}` : 'pronouns_modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Pronouns');

    const pronounsInput = new TextInputBuilder()
        .setCustomId('pronouns_input')
        .setLabel('Pronouns')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Examples: they/them, she/her, he/him, any pronouns')
        .setRequired(true)
        .setMaxLength(50);

    const firstActionRow = new ActionRowBuilder().addComponents(pronounsInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
