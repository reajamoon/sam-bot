import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { parseButtonId } from '../../../../shared/utils/buttonId.js';

/**
 * Handler for the set bio button, shows the bio modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleBio(interaction) {
    const parsed = parseButtonId(interaction.customId);
    const targetUserId = parsed ? parsed.primaryId : interaction.user.id;
    const originalMessageId = parsed ? parsed.secondaryId : null;
    // Build modal custom ID with message tracking if available
    const modalCustomId = originalMessageId ? `bio_modal_${originalMessageId}` : 'bio_modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Bio');

    const bioInput = new TextInputBuilder()
        .setCustomId('bio_input')
        .setLabel('Bio (1000 characters max)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Tell us about yourself! Interests, fandoms, anything you want to share.')
        .setRequired(true)
        .setMaxLength(1000);

    const firstActionRow = new ActionRowBuilder().addComponents(bioInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
