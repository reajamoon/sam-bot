/**
 * Utility for robust profile message ID tracking and propagation
 * Ensures all profile settings/menu buttons carry the original profile card message ID
 */
const logger = require('./logger');

/**
 * Extracts the original profile card message ID from customId, interaction, or fallback
 * @param {Object} interaction - Discord interaction object
 * @param {string} [customId] - Optional customId to parse
 * @returns {string|null} - Valid Discord message ID or null
 */
function getProfileMessageId(interaction, customId) {
    // Try to parse from customId
    let messageId = null;
    if (customId) {
        const parts = customId.split('_');
        // Look for a valid snowflake in the last segment
        const last = parts[parts.length - 1];
        if (/^\d{17,19}$/.test(last)) {
            messageId = last;
        }
    }
    // Fallback: try to parse from interaction.message.id if valid
    if (!messageId && interaction.message && interaction.message.id && /^\d{17,19}$/.test(interaction.message.id)) {
        messageId = interaction.message.id;
    }
    // Log for debugging
    logger.info('[ProfileMessageTracker] getProfileMessageId', { customId, resolvedMessageId: messageId });
    return messageId || null;
}

/**
 * Ensures all profile settings/menu buttons propagate the original profile card message ID
 * @param {string} action - Button action
 * @param {string} context - Button context
 * @param {string} userId - Discord user ID
 * @param {string} messageId - Original profile card message ID
 * @returns {string} - Button custom ID
 */
function buildProfileButtonId(action, context, userId, messageId) {
    // Only propagate valid message IDs
    const secondaryId = /^\d{17,19}$/.test(messageId) ? messageId : '';
    return `${action}_${context}_${userId}${secondaryId ? `_${secondaryId}` : ''}`;
}

module.exports = {
    getProfileMessageId,
    buildProfileButtonId
};
