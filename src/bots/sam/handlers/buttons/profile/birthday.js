const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { buildModalCustomId, buildInputCustomId } = require('../../../../../shared/utils/messageTracking');

async function handleBirthday(interaction) {
    // Use robust utility for messageId
    const { getProfileMessageId } = require('../../../../../shared/utils/messageTracking');
    const targetUserId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    // Build modal custom ID with message tracking if available
    const modalCustomId = buildModalCustomId('birthday', originalMessageId);

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

module.exports = { handleBirthday };
