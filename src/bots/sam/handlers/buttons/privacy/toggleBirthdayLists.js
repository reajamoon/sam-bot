// Handler for toggling birthday lists privacy setting
const { User } = require('../../../../../models');
const { parsePrivacySettingsCustomId } = require('../../../../../shared/utils/messageTracking');
const { getProfileMessageId } = require('../../../utils/profileMessageTracker');
const { buildPrivacySettingsMenu } = require('./privacyMenu');
const { performDualUpdate } = require('../../../utils/dualUpdate');
const logger = require('../../../../../shared/utils/logger');
const { InteractionFlags } = require('discord.js');

module.exports = async function handleToggleBirthdayLists(interaction) {
    // Ephemeral message flag pattern: use InteractionFlags.Ephemeral if available, otherwise fallback to 64.
    // This ensures compatibility across discord.js versions and prevents undefined errors.
    const ephemeralFlag = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
    try {
        // Always extract the original profile card message ID from the customId only
        const { parsePrivacySettingsCustomId } = require('../../../../../shared/utils/messageTracking');
        let originalMessageId = null;
        const parsed = parsePrivacySettingsCustomId(interaction.customId);
        if (parsed && parsed.messageId && /^\d{17,19}$/.test(parsed.messageId)) {
            originalMessageId = parsed.messageId;
        }
        if (!originalMessageId) {
            logger.error('[toggleBirthdayLists] Missing or invalid original profile card message ID', { customId: interaction.customId });
            throw new Error('toggleBirthdayLists: Missing or invalid original profile card message ID');
        }
        logger.debug('[toggleBirthdayLists] Extracted original profile card message ID', { originalMessageId, customId: interaction.customId });
        // Robust messageId validation (fetch and check ownership)
        if (originalMessageId) {
            try {
                const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed || !originalEmbed.fields) {
                    logger.warn(`Privacy: Original message ${originalMessageId} has no embed fields, treating as stale`);
                    originalMessageId = null;
                } else {
                    const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                    if (!userIdField || userIdField.value !== interaction.user.id) {
                        logger.warn(`Privacy: Original message ${originalMessageId} belongs to different user, treating as stale`);
                        originalMessageId = null;
                    }
                }
            } catch (fetchError) {
                logger.warn(`Privacy: Could not fetch original message ${originalMessageId}, treating as stale:`, fetchError);
                originalMessageId = null;
            }
        }

        const [user] = await User.findOrCreate({
            where: { discordId: interaction.user.id },
            defaults: {
                discordId: interaction.user.id,
                username: interaction.user.username,
                discriminator: interaction.user.discriminator || '0',
                avatar: interaction.user.avatar
            }
        });

        const currentValue = user.birthdayAnnouncements !== false;
        await User.update(
            { birthdayAnnouncements: !currentValue },
            { where: { discordId: interaction.user.id } }
        );

        // Get updated user data and build refreshed menu
        const updatedUser = await User.findOne({ where: { discordId: interaction.user.id } });
    logger.debug('[toggleBirthdayLists] Propagating original profile message ID to menu builder', { originalMessageId });
    const { components, embeds } = buildPrivacySettingsMenu(updatedUser, interaction.user.id, originalMessageId, originalMessageId, interaction);
        // Use shared dual update system
        const dualUpdateSuccess = await performDualUpdate(
            interaction,
            { components, embeds, flags: ephemeralFlag },
            originalMessageId,
            'toggle birthday lists'
        );

        logger.info(`User ${interaction.user.tag} ${!currentValue ? 'enabled' : 'disabled'} birthday announcements${dualUpdateSuccess ? ' (dual update)' : ' (menu only)'}`, { service: 'discord-bot' });
    } catch (error) {
        logger.error(`Error toggling birthday announcements for ${interaction.user.tag}:`, error);
        const errorMsg = 'Something went wrong updating your daily lists setting. Want to try that again?';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: ephemeralFlag });
        } else {
            await interaction.reply({ content: errorMsg, flags: ephemeralFlag });
        }
    }
};