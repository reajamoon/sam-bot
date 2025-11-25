import { parseProfileSettingsCustomId, decodeMessageId } from '../../../../shared/utils/messageTracking.js';
import { handleInteractionNavigation } from '../../../../shared/utils/interactionNavigation.js';
import logger from '../../../../shared/utils/logger.js';

/**
 * Handler for closing the profile settings menu.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleProfileSettingsDone(interaction) {
    logger.info(`[ProfileSettingsDone] Received customId: ${interaction.customId}`);
    let profileOwnerId = null;
    let originalMessageId = null;
    const parsed = parseProfileSettingsCustomId(interaction.customId);
    if (parsed && parsed.userId && parsed.messageId) {
        profileOwnerId = parsed.userId;
        // If messageId looks base64, decode it
        originalMessageId = /^[A-Za-z0-9+/=]+$/.test(parsed.messageId) && parsed.messageId.length > 16
            ? decodeMessageId(parsed.messageId)
            : parsed.messageId;
    }
    logger.info(`[ProfileSettingsDone] Parsed userId: ${profileOwnerId}, messageId: ${originalMessageId}`);
    await handleInteractionNavigation(interaction, {
        type: 'close',
        content: '✅ Profile Settings closed.',
        components: [],
        embeds: []
    });
}
