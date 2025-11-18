const { User } = require('../../../../models');
const { generateProfileCard, createProfileButtons } = require('./profileCard');
const logger = require('../../../shared/utils/logger');

/**
 * Update the original profile message with fresh user data (Sam-specific)
 * @param {Interaction} interaction - Discord interaction object
 * @param {string} originalMessageId - ID of the original profile message to update
 * @param {string} actionDescription - Description of what action triggered the update (for logging)
 * @param {Object} options - Additional options
 * @param {boolean} options.skipOwnershipCheck - Skip profile ownership verification (default: false)
 * @returns {Promise<boolean>} - True if update was successful, false otherwise
 */
async function updateOriginalProfile(interaction, originalMessageId, actionDescription, options = {}) {
    if (!originalMessageId) {
        return false;
    }
    try {
        // Fetch the original message
        const message = await interaction.channel.messages.fetch(originalMessageId);
        if (!message) {
            logger.warn(`Could not fetch original message ${originalMessageId} for ${actionDescription}`, { service: 'discord-bot' });
            return false;
        }
        // Verify ownership (bot must own the message)
        if (message.author.id !== interaction.client.user.id) {
            logger.warn(`Profile ownership verification failed for message ${originalMessageId}. Expected bot ID: ${interaction.client.user.id}, Found: ${message.author.id}`, { service: 'discord-bot' });
            return false;
        }
        // Additional ownership check - verify the profile belongs to the interaction user
        if (!options.skipOwnershipCheck) {
            const embed = message.embeds[0];
            if (embed && embed.fields) {
                const userIdField = embed.fields.find(field => field.name === 'User ID');
                if (userIdField && userIdField.value !== interaction.user.id) {
                    logger.warn(`Profile user verification failed for message ${originalMessageId}. Expected: ${interaction.user.id}, Found: ${userIdField.value}`, { service: 'discord-bot' });
                    return false;
                }
            }
        }
        // Get fresh user data from database
        const updatedUser = await User.findByPk(interaction.user.id);
        if (!updatedUser) {
            logger.warn(`Could not fetch updated user data for ${interaction.user.id} during ${actionDescription}`, { service: 'discord-bot' });
            return false;
        }
        // Generate fresh profile embed and buttons
        const { embed } = await generateProfileCard(interaction.user, updatedUser, interaction.client, interaction);
        const buttons = createProfileButtons(interaction.user.id, interaction.user.id, originalMessageId);
        if (!embed) {
            logger.warn(`Profile embed generation failed for ${actionDescription}`, { service: 'discord-bot' });
            return false;
        }
        // Update the original message
        await message.edit({
            embeds: [embed],
            components: buttons
        });
        logger.info(`Successfully updated profile message ${originalMessageId} after ${actionDescription}`, { service: 'discord-bot' });
        return true;
    } catch (error) {
        logger.error(`Error updating profile message ${originalMessageId} after ${actionDescription}:`, error, { service: 'discord-bot' });
        return false;
    }
}

module.exports = { updateOriginalProfile };
