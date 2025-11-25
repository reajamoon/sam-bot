import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { parseButtonId } from '../../../../shared/utils/buttonId.js';

/**
 * Handler for the set region button, shows the region modal.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleRegion(interaction) {
    const parsed = parseButtonId(interaction.customId);
    const targetUserId = parsed ? parsed.primaryId : interaction.user.id;
    const originalMessageId = parsed ? parsed.secondaryId : null;
    // Build modal custom ID with message tracking if available
    const modalCustomId = originalMessageId ? `region_modal_${originalMessageId}` : 'region_modal';

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Set Your Region');

    const regionInput = new TextInputBuilder()
        .setCustomId('region_input')
        .setLabel('Region, Country, or Timezone Area')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., California, Canada, Japan, Europe, Pacific Time')
        .setRequired(false)
        .setMaxLength(50);

    const firstActionRow = new ActionRowBuilder().addComponents(regionInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}
