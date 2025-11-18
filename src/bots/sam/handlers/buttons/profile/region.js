const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { parseButtonId } = require('../../../../../shared/utils/buttonId');
const { buildModalCustomId, buildSelectMenuCustomId, buildInputCustomId } = require('../../../../../shared/utils/messageTracking');

async function handleRegion(interaction) {
    // Always extract the message ID from the incoming customId
    const { getProfileMessageId } = require('../../../../../shared/utils/messageTracking');
    const targetUserId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // When building the modal, always include the extracted message ID
    const modalCustomId = originalMessageId ? buildModalCustomId('region', originalMessageId) : 'region_modal';

    // Build modal custom ID with message tracking if available
    // (already declared above)

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

module.exports = { handleRegion };
