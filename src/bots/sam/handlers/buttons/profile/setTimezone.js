const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, InteractionFlags } = require('discord.js');
const logger = require('../../../../../shared/utils/logger');
const { buildModalCustomId, getProfileMessageId } = require('../../../../../shared/utils/messageTracking');

async function handleTimezone(interaction) {
    // Defensive logging
    logger.info(`[handleTimezone] Invoked for customId: ${interaction.customId}`);
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    const modalCustomId = buildModalCustomId('timezone', originalMessageId);
    logger.info(`[handleTimezone] Preparing to show modal. modalCustomId: ${modalCustomId}, originalMessageId: ${originalMessageId}`);

    let modalError = null;
    try {
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

        logger.info(`[handleTimezone] About to call interaction.showModal for modalCustomId: ${modalCustomId}`);
        await interaction.showModal(modal);
        logger.info(`[handleTimezone] showModal called successfully for modalCustomId: ${modalCustomId}`);
    } catch (err) {
        modalError = err;
        logger.error(`[handleTimezone] Exception thrown by interaction.showModal for modalCustomId: ${modalCustomId}, originalMessageId: ${originalMessageId}. Error: ${err && err.stack ? err.stack : err}`);
    }
    if (modalError) {
        try {
            await interaction.reply({
                content: '❌ Something went wrong showing the timezone modal. Please try again or contact Sam.',
                flags: InteractionFlags.Ephemeral || 64
            });
        } catch (replyError) {
            logger.error(`[handleTimezone] Failed to send fallback reply after modal error: ${replyError && replyError.stack ? replyError.stack : replyError}`);
        }
    }
}

module.exports = { handleTimezone };
