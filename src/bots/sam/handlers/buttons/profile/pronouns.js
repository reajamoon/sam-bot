const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { buildModalCustomId, buildInputCustomId } = require('../../../../../shared/utils/messageTracking');

async function handlePronouns(interaction) {
    const { getProfileMessageId } = require('../../../../../shared/utils/messageTracking');
    const targetUserId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Build modal custom ID with message tracking if available
    const modalCustomId = buildModalCustomId('pronouns', originalMessageId);

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

module.exports = { handlePronouns };
