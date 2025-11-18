const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { parseButtonId } = require('../../../../../shared/utils/buttonId');
const { parseProfileSettingsCustomId } = require('../../../../../shared/utils/messageTracking');
const { buildModalCustomId, buildInputCustomId } = require('../../../../../shared/utils/messageTracking');

async function handleBio(interaction) {
    const { getProfileMessageId } = require('../../../../../shared/utils/messageTracking');
    const targetUserId = interaction.user.id;
    // Use robust utility for messageId
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Build modal custom ID with message tracking if available
    const modalCustomId = buildModalCustomId('bio', originalMessageId);

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

module.exports = { handleBio };
