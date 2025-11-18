const { Events } = require('discord.js');
const logger = require('../../../shared/utils/logger');

// Import specialized handlers
const { handleCommand } = require('../../handlers/commandHandler');
const { handleButton } = require('../../handlers/buttonHandler');
const { handleSelectMenu } = require('../../handlers/selectMenuHandler');
const { handleModal } = require('../../handlers/modalHandler');

// In-memory set to track processed interaction IDs
const processedInteractionIds = new Set();

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            if (processedInteractionIds.has(interaction.id)) {
                logger.warn(`Duplicate interaction detected: id=${interaction.id}, type=${interaction.type}, customId=${interaction.customId || 'none'}, commandName=${interaction.commandName || 'none'}`);
            } else {
                processedInteractionIds.add(interaction.id);
            }
            console.log(`Interaction received: id=${interaction.id}, type=${interaction.type}, customId=${interaction.customId || 'none'}, commandName=${interaction.commandName || 'none'}`);
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                return await handleCommand(interaction);
            }
            // Handle button interactions
            else if (interaction.isButton()) {
                return await handleButton(interaction);
            }
            // Handle select menu interactions
            else if (interaction.isStringSelectMenu()) {
                return await handleSelectMenu(interaction);
            }
            // Handle modal submissions
            else if (interaction.isModalSubmit()) {
                return await handleModal(interaction);
            }
            // Unknown interaction type
            else {
                logger.warn(`Unknown interaction type: ${interaction.type}`);
            }
        } catch (error) {
            logger.error('Error in interaction handler:', error);
            // Try to respond to the user if we haven't already
            try {
                const { InteractionFlags } = require('discord.js');
                const EPHEMERAL_FLAG = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
                // Prevent double replies and expired token errors
                if (typeof interaction.isExpired === 'function' && interaction.isExpired()) {
                    logger.warn('Interaction is expired, cannot reply or update.', { customId: interaction.customId });
                    return;
                }
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Something went wrong processing that interaction. Please try again.',
                        flags: EPHEMERAL_FLAG
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({
                        content: 'Something went wrong processing that interaction. Please try again.',
                        components: []
                    });
                }
            } catch (responseError) {
                logger.error('Error responding to failed interaction:', responseError);
            }
        }
    }
}