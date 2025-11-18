const { updateOriginalProfile } = require('../../bots/sam/utils/updateOriginalProfile');


/**
 * Extract message ID from button custom ID
 * Handles both direct message ID format and encoded format
 * 
 * @param {string} customId - Button custom ID
 * @returns {string|null} - Extracted message ID or null if not found
 */
function extractMessageIdFromCustomId(customId) {
    if (!customId) return null;

    // Pattern: action_userId_messageId
    const parts = customId.split('_');
    if (parts.length >= 3) {
        const potentialMessageId = parts[parts.length - 1];
        
        // Check if it's a valid Discord snowflake (18-19 digits)
        if (/^\d{17,19}$/.test(potentialMessageId)) {
            return potentialMessageId;
        }
    }

    return null;
}

/**
 * Dual update helper - updates both ephemeral response and original profile
 * This is a convenience function that combines ephemeral response and profile update
 * 
 * @param {Interaction} interaction - Discord interaction object
 * @param {Object} ephemeralResponse - Ephemeral response data (embeds, components, etc.)
 * @param {string} originalMessageId - ID of original profile message to update
 * @param {string} actionDescription - Description of the action for logging
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - True if both updates successful, false otherwise
 */
async function performDualUpdate(interaction, ephemeralResponse, originalMessageId, actionDescription, options = {}) {
    try {
        // If this is a button interaction from an ephemeral message, update instead of reply
        if (interaction.isButton && interaction.message && interaction.message.flags?.has('Ephemeral')) {
            await interaction.update(ephemeralResponse);
        } else if (interaction.replied || interaction.deferred) {
            await interaction.editReply(ephemeralResponse);
        } else {
            await interaction.reply({
                ...ephemeralResponse,
                flags: 64
            });
        }

        // Validate originalMessageId before updating profile
        let validMessageId = null;
        if (originalMessageId && /^\d{17,19}$/.test(originalMessageId)) {
            validMessageId = originalMessageId;
        } else {
            logger.warn(`Invalid originalMessageId provided for dual update: ${originalMessageId}`, { service: 'discord-bot' });
        }

        // Update original profile in background only if valid
        let profileUpdateSuccess = false;
        if (validMessageId) {
            profileUpdateSuccess = await updateOriginalProfile(interaction, validMessageId, actionDescription, options);
        }

        if (profileUpdateSuccess) {
            logger.info(`Dual update completed for ${actionDescription}`, { service: 'discord-bot' });
        }

        return profileUpdateSuccess;

    } catch (error) {
        logger.error(`Error during dual update for ${actionDescription}:`, error, { service: 'discord-bot' });
        return false;
    }
}

module.exports = {
    updateOriginalProfile,
    extractMessageIdFromCustomId,
    performDualUpdate
};