import Discord from 'discord.js';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, InteractionFlags } = Discord;
const EPHEMERAL_FLAG = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
import { User } from '../../../../models/index.js';
import logger from '../../../../shared/utils/logger.js';
import { parsePrivacySettingsCustomId, getProfileMessageId } from '../../../../shared/utils/messageTracking.js';
import { buildPrivacySettingsMenu } from './privacy/privacyMenu.js';
import { performDualUpdate } from '../../../../shared/utils/dualUpdate.js';
import { handleInteractionNavigation } from '../../../../shared/utils/interactionNavigation.js';
/**
 * Handle privacy and settings button interactions
 */
export async function handlePrivacyButtons(interaction) {
    // Extract userId and messageId from customId using utility
    const { getProfileOwnerIdFromInteraction } = await import('../../../../shared/utils/messageTracking.js');
    const trackedData = parsePrivacySettingsCustomId(interaction.customId);
    const profileOwnerId = getProfileOwnerIdFromInteraction(interaction);
    // Use robust tracker for message ID
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Debug logging for all privacy button interactions
    logger.info(`[PrivacyButtons] Received interaction: customId=${interaction.customId}, userId=${interaction.user.id}`);
    logger.info(`[PrivacyButtons] Parsed profileOwnerId=${profileOwnerId}, interactionUserId=${interaction.user.id}`);

    // Security check: only allow editing own privacy settings
    if (profileOwnerId && interaction.user.id !== profileOwnerId) {
    // Ephemeral message flag pattern: use InteractionFlags.Ephemeral if available, otherwise fallback to 64.
    // This ensures compatibility across discord.js versions and prevents undefined errors.
        await interaction.reply({
            content: `**You can't edit someone else's privacy settings!**\n\nTo edit your own privacy settings, use:\n\`/profile\` - View and edit your profile\n\`/profile help\` - Learn about privacy features`,
            flags: EPHEMERAL_FLAG
        });
        return;
    }

    // Main privacy settings menu
    if (interaction.customId === 'privacy_settings' ||
        (interaction.customId.startsWith('privacy_settings_') && !interaction.customId.startsWith('privacy_settings_done_'))) {

        // Try to parse message tracking from custom ID
        const trackedData = parsePrivacySettingsCustomId(interaction.customId);
        const originalMessageId = getProfileMessageId(interaction, interaction.customId);

        const user = await User.findOrCreate({
            where: { discordId: interaction.user.id },
            defaults: {
                discordId: interaction.user.id,
                username: interaction.user.username,
                discriminator: interaction.user.discriminator || '0',
                avatar: interaction.user.avatar
            }
        });
        const userData = user[0];
        const { components, embeds } = buildPrivacySettingsMenu(userData, interaction.user.id, originalMessageId);
        // If this is a new interaction (not updating an ephemeral menu), reply ephemeral
        if (!interaction.message || !interaction.message.flags?.has('Ephemeral')) {
            await interaction.reply({ components, embeds, flags: EPHEMERAL_FLAG });
        } else {
            await interaction.update({ components, embeds });
        }
        return;
    }

    // Individual privacy toggles
    else if (interaction.customId.includes('toggle_birthday_mentions_privacy_settings_')) {
        const { handleToggleBirthdayMentions } = await import('./privacy/index.js');
        await handleToggleBirthdayMentions(interaction);
    }

    // Toggle birthday lists (daily announcements)
    else if (interaction.customId.includes('toggle_birthday_lists_privacy_settings_')) {
        const { handleToggleBirthdayLists } = await import('./privacy/index.js');
        await handleToggleBirthdayLists(interaction);
    }

    // Toggle Privacy Mode (Full) - hides ALL birthday info
    else if (interaction.customId.includes('toggle_privacy_mode_full_privacy_settings_')) {
        const { handleTogglePrivacyModeFull } = await import('./privacy/index.js');
        await handleTogglePrivacyModeFull(interaction);
    }

    // Toggle Privacy Mode (Age Hidden) - hides only age, shows birthday/zodiac
    else if (interaction.customId.includes('toggle_privacy_mode_age_hidden_privacy_settings_')) {
        const { handleTogglePrivacyModeAgeHidden } = await import('./privacy/index.js');
        await handleTogglePrivacyModeAgeHidden(interaction);
    }

    // Privacy settings done - close the privacy menu (robust navigation logic)
    else if (
        interaction.customId === 'privacy_settings_done' ||
        interaction.customId.startsWith('privacy_settings_done_')
    ) {
        await handleInteractionNavigation(interaction, {
            type: 'close',
            content: '✅ Privacy Settings closed.',
            components: [],
            embeds: []
        });
        return;
    }

    // Toggle birthday hidden (profile birthday visibility)
    else if (interaction.customId.includes('toggle_birthday_hidden_privacy_settings_')) {
        const { handleToggleBirthdayHidden } = await import('./privacy/index.js');
        await handleToggleBirthdayHidden(interaction);
    }
    // Additional privacy toggle handlers would go here...
}