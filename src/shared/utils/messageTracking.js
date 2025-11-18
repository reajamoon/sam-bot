/**
 * PROFILE-SPECIFIC FUNCTIONS
 * Robust profile message ID tracking and propagation
 */
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
/**
 * Extract the profile owner's user ID from a button interaction
 * @param {import('discord.js').ButtonInteraction} interaction - Discord button interaction
 * @returns {string} Profile owner's user ID
 */
function getProfileOwnerIdFromInteraction(interaction) {
    const parsed = parseProfileSettingsCustomId(interaction.customId);
    return parsed && parsed.userId ? parsed.userId : interaction.user.id;
}
/**
 * Stub for parsePrivacySettingsDoneCustomId
 * TODO: Implement actual logic if needed
 */
function parsePrivacySettingsDoneCustomId(customId) {
    return {};
}
const logger = require('./logger'); // already correct, no change needed

/**
 * Message tracking utilities for live profile updates
 * Handles encoding/decoding message IDs in button custom IDs
 */

/**
 * Encode message ID for safe inclusion in custom ID
 * Discord custom IDs have 100 character limit, so we use base64 for efficiency
 * @param {string} messageId - Discord message ID to encode
 * @returns {string} Encoded message ID
 */
function encodeMessageId(messageId) {
    try {
        // Convert to base64 to save space in custom ID
        return Buffer.from(messageId).toString('base64');
    } catch (error) {
        logger.error('Error encoding message ID:', error);
        return messageId; // Fallback to original if encoding fails
    }
}

/**
 * Decode message ID from custom ID
 * @param {string} encodedMessageId - Encoded message ID from custom ID
 * @returns {string} Original Discord message ID
 */
function decodeMessageId(encodedMessageId) {
    try {
        // Decode from base64
        return Buffer.from(encodedMessageId, 'base64').toString();
    } catch (error) {
        logger.error('Error decoding message ID:', error);
        return encodedMessageId; // Fallback to encoded version if decoding fails
    }
}

/**
 * Build privacy settings custom ID with message tracking
 * Pattern: privacy_settings_${userId}_${encodedMessageId}
 * @param {string} userId - Discord user ID
 * @param {string} messageId - Original profile message ID
 * @returns {string} Complete custom ID for privacy settings button
 */
function buildPrivacySettingsCustomId(userId, messageId) {
    const encodedMsgId = encodeMessageId(messageId);
    return `privacy_settings_${userId}_${encodedMsgId}`;
}

/**
 * Parse privacy settings custom ID to extract components
 * Accepts formats with or without action prefix:
 * - privacy_settings_<userId>_<encodedMessageId>
 * - <action>_privacy_settings_<userId>_<encodedMessageId>
 * @param {string} customId - The custom ID to parse
 * @returns {Object|null} Object with userId and messageId, or null if invalid
 */
function parsePrivacySettingsCustomId(customId) {
    try {
        const parts = customId.split('_');
        let privacyIdx = parts.indexOf('privacy');
        let settingsIdx = parts.indexOf('settings');
        // Find the start of the privacy_settings block
        if (privacyIdx === -1 || settingsIdx !== privacyIdx + 1) {
            return null;
        }
        // userId and encodedMessageId follow privacy_settings (skip action prefix)
        const userId = parts[privacyIdx + 2];
        const encodedMessageId = parts.slice(privacyIdx + 3).join('_');
        const messageId = decodeMessageId(encodedMessageId);
        return {
            userId,
            messageId,
            encodedMessageId
        };
    } catch (error) {
        logger.error('Error parsing privacy settings done custom ID:', error);
        return null;
    }
}

/**
 * Check if a custom ID is a privacy settings button with message tracking
 * @param {string} customId - Custom ID to check
 * @returns {boolean} True if this is a tracked privacy settings button
 */
function isTrackedPrivacySettings(customId) {
    const parsed = parsePrivacySettingsCustomId(customId);
    return parsed !== null && parsed.messageId && parsed.userId;
}

/**
 * Build privacy settings done custom ID with message tracking
 * Pattern: privacy_settings_done_${userId}_${encodedMessageId}
 * @param {string} userId - Discord user ID
 * @param {string} messageId - Original profile message ID
 * @returns {string} Complete custom ID for privacy settings done button
 */
function buildPrivacySettingsDoneCustomId(userId, messageId) {
    const encodedMsgId = encodeMessageId(messageId);
    return `privacy_settings_done_${userId}_${encodedMsgId}`;
}

/**
 * Parse privacy settings done custom ID to extract components
 * @param {string} customId - The custom ID to parse
 * @returns {Object|null} Object with userId and messageId, or null if invalid
 */

/**
 * Build profile settings custom ID with message tracking
 * Pattern: profile_settings_${userId}_${encodedMessageId}
 * @param {string} userId - Discord user ID
 * @param {string} messageId - Original profile message ID
 * @returns {string} Complete custom ID for profile settings button
 */
function buildProfileSettingsCustomId(userId, messageId) {
    const encodedMsgId = encodeMessageId(messageId);
    return `profile_settings_${userId}_${encodedMsgId}`;
}

/**
 * Parse profile settings custom ID to extract components
 * Accepts formats with or without action prefix:
 * - profile_settings_<userId>_<messageId>
 * - <action>_profile_settings_<userId>_<messageId>
 * @param {string} customId - The custom ID to parse
 * @returns {Object|null} Object with userId and messageId, or null if invalid
 */
function parseProfileSettingsCustomId(customId) {
    try {
        const parts = customId.split('_');
        let profileIdx = parts.indexOf('profile');
        let settingsIdx = parts.indexOf('settings');
        // Find the start of the profile_settings block
        if (profileIdx === -1 || settingsIdx !== profileIdx + 1) {
            return null;
        }
        // userId and messageId follow profile_settings
        const userId = parts[settingsIdx + 1];
        const messageId = parts[settingsIdx + 2];
        return {
            userId,
            messageId
        };
    } catch (error) {
        logger.error('Error parsing profile settings custom ID:', error);
        return null;
    }
}

/**
 * Check if a custom ID is a profile settings button with message tracking
 * @param {string} customId - Custom ID to check
 * @returns {boolean} True if this is a tracked profile settings button
 */
function isTrackedProfileSettings(customId) {
    const parsed = parseProfileSettingsCustomId(customId);
    return parsed !== null && parsed.messageId && parsed.userId;
}

/**
 * Build profile settings done custom ID with message tracking
 * Pattern: profile_settings_done_<userId>_<encodedMessageId>
 * @param {string} userId - Discord user ID
 * @param {string} messageId - Original profile message ID
 * @returns {string} Complete custom ID for profile settings done button
 */
function buildProfileSettingsDoneCustomId(userId, messageId) {
    const encodedMsgId = encodeMessageId(messageId);
    return `profile_settings_done_${userId}_${encodedMsgId}`;
}

/**
 * Centralized builder for modal custom IDs
 * Format: <type>_modal_<messageId>
 */
function buildModalCustomId(type, messageId) {
    return messageId ? `${type}_modal_${messageId}` : `${type}_modal`;
}

/**
 * Centralized builder for select menu custom IDs
 * Format: <context>_select_<messageId>
 */
function buildSelectMenuCustomId(context, messageId) {
    return messageId ? `${context}_select_${messageId}` : `${context}_select`;
}

/**
 * Centralized builder for input field custom IDs
 * Format: <type>_input_<messageId>
 */
function buildInputCustomId(type, messageId) {
    return messageId ? `${type}_input_${messageId}` : `${type}_input`;
}

module.exports = {
    // General
    encodeMessageId,
    decodeMessageId,
    buildModalCustomId,
    buildSelectMenuCustomId,
    buildInputCustomId,
    // Profile-specific
    getProfileMessageId,
    buildProfileButtonId,
    buildProfileSettingsCustomId,
    buildProfileSettingsDoneCustomId,
    parseProfileSettingsCustomId,
    isTrackedProfileSettings,
    getProfileOwnerIdFromInteraction,
    // Privacy-specific
    buildPrivacySettingsCustomId,
    buildPrivacySettingsDoneCustomId,
    parsePrivacySettingsCustomId,
    isTrackedPrivacySettings,
    parsePrivacySettingsDoneCustomId,
};