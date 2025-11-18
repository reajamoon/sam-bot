const logger = require('../../../shared/utils/logger');

/**
 * Handle slash command interactions
 */
async function handleCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
        logger.info(`Command ${interaction.commandName} executed by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
    } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);

        // Check if the error is due to an unknown interaction (expired token)
        const isUnknownInteraction = error.code === 10062 || error.rawError?.code === 10062;
        
        if (isUnknownInteraction) {
            logger.warn(`Interaction token expired for command ${interaction.commandName}`);
            return; // Don't try to respond to expired interactions
        }

        const errorMessage = {
            content: 'There was an error while executing this command!',
            flags: 64
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (followUpError) {
            logger.error('Failed to send error message to user:', followUpError);
        }
    }
}

module.exports = { handleCommand };