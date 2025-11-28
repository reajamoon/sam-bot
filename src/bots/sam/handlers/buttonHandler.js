
import Discord from 'discord.js';
const { InteractionFlags } = Discord;
const EPHEMERAL_FLAG = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
import { handleProfileButtons } from './buttons/profile/index.js';
import { handleNavigationButtons } from './buttons/navigation/index.js';
import { handlePrivacyButtons } from './buttons/privacyButtons.js';
import { handleStatsChartsButton } from './buttons/handleStatsCharts.js';
import { parseStatsButtonId } from '../utils/statsButtonId.js';
import { getStatsChartCache, clearStatsChartCache } from '../utils/statsChartCache.js';
import logger from '../../../shared/utils/logger.js';

/**
 * Handle button interactions by delegating to appropriate handlers
 */
async function handleButton(interaction) {
    // Stats charts button (including back button)
    if (interaction.customId && (interaction.customId.startsWith('stats_charts') || interaction.customId.startsWith('stats_charts_back:'))) {
        // For back button, let the handler decide what to do
        if (interaction.customId.startsWith('stats_charts_back:')) {
            await handleStatsChartsButton(interaction);
            return;
        }
        // Extract and decode messageId from customId
        const customId = interaction.customId;
        const parts = customId.split(':');
        const encodedMessageId = parts[parts.length - 1];
        let decodedMessageId = null;
        if (encodedMessageId) {
            try {
                decodedMessageId = Buffer.from(encodedMessageId, 'base64').toString('utf8');
            } catch (e) {
                console.error('[buttonHandler] Failed to decode messageId from base64:', encodedMessageId, e);
            }
        }
        const cacheKey = decodedMessageId ? `stats:${decodedMessageId}` : null;
        const files = cacheKey ? getStatsChartCache(cacheKey) : [];
        await handleStatsChartsButton(interaction, { files: files || [] });
        // Optionally clear cache after use
        if (cacheKey) clearStatsChartCache(cacheKey);
        return;
    }
    try {
        logger.info(`[buttonHandler] Invoked for customId: ${interaction.customId}`);
        const customId = interaction.customId;
    // logger.info(`[ButtonHandler] Received button interaction: customId=${customId}`);

        // Rec search pagination buttons
        if (customId && customId.startsWith('recsearch')) {
            // Route to rec.js handler (new location)
            console.log('[buttonHandler] Routing recsearch button to rec.js');
            const rec = await import('../commands/rec.js');
            await rec.default.handleButtonInteraction(interaction);
            return;
        }

        // Profile editing buttons
        if (customId === 'profile_settings' || customId.startsWith('profile_settings_') ||
            customId === 'profile_settings_done' || customId.startsWith('profile_settings_done_') ||
            customId === 'back_to_profile_settings' || customId.startsWith('back_to_profile_settings_') ||
            customId === 'timezone_display' || customId.startsWith('timezone_display_') ||
            customId === 'set_birthday' || customId.startsWith('set_birthday_') ||
            customId === 'confirm_set_birthday' ||
            customId === 'set_timezone' || customId.startsWith('set_timezone_') ||
            customId === 'set_pronouns' || customId.startsWith('set_pronouns_') ||
            customId === 'confirm_set_pronouns' ||
            customId === 'set_bio' || customId.startsWith('set_bio_') ||
            customId === 'confirm_set_bio' ||
            customId === 'set_region' || customId.startsWith('set_region_') ||
            customId === 'toggle_region_display' || customId.startsWith('toggle_region_display_')) {
            // logger.info(`[ButtonHandler] Routing to handleProfileButtons for customId=${customId}`);
            await handleProfileButtons(interaction);
            return;
        }

        // Navigation and help buttons (legacy and new modular format)
        if (
            customId === 'profile_help' ||
            customId === 'profile_help_main' ||
            customId === 'profile_help_birthday' ||
            customId === 'profile_help_bio' ||
            customId === 'profile_help_privacy' ||
            customId === 'profile_help_tips' ||
            customId === 'profile_help_timezone' ||
            customId === 'profile_help_pronouns' ||
            customId === 'profile_help_timezone_region' ||
            customId === 'close_help' ||
            customId === 'back_to_profile' ||
            /(_profile_help_menu_)/.test(customId) // new modular help menu buttonId format
        ) {
            // logger.info(`[ButtonHandler] Routing to handleNavigationButtons for customId=${customId}`);
            await handleNavigationButtons(interaction);
            return;
        }

        // Rec help navigation buttons
        if (customId.startsWith('rec_help_')) {
            // logger.info(`[ButtonHandler] Routing to handleHelpNavigation for customId=${customId}`);
            const rec = await import('../commands/rec.js');
            await rec.handleHelpNavigation(interaction);
            return;
        }

        // Privacy and settings buttons
        if (customId === 'privacy_settings' || customId.startsWith('privacy_settings_') ||
            customId === 'privacy_settings_done' || customId.startsWith('privacy_settings_done_') ||
            customId === 'toggle_birthday_mentions' || customId.startsWith('toggle_birthday_mentions_') ||
            customId === 'toggle_birthday_lists' || customId.startsWith('toggle_birthday_lists_') ||
            customId === 'toggle_birthday_announcements' ||
            customId === 'toggle_privacy_mode_full' || customId.startsWith('toggle_privacy_mode_full_') ||
            customId === 'toggle_privacy_mode_age_hidden' || customId.startsWith('toggle_privacy_mode_age_hidden_') ||
            customId === 'toggle_birthday_hidden' || customId.startsWith('toggle_birthday_hidden_')) {
            // logger.info(`[ButtonHandler] Routing to handlePrivacyButtons for customId=${customId}`);
            await handlePrivacyButtons(interaction);
            return;
        }

        // If we get here, the button wasn't handled by any specialized handler
        logger.warn(`[ButtonHandler] Unhandled button interaction: customId=${customId}`);
        await interaction.reply({
            content: 'This button interaction is not currently supported.',
            flags: EPHEMERAL_FLAG
        });

    } catch (error) {
        logger.error('Error in button handler:', error);

        try {
            if (!interaction.replied && !interaction.deferred) {
                // Ensure InteractionFlags is always available
                await interaction.reply({
                    content: 'Something went wrong processing that button. Please try again.',
                    flags: EPHEMERAL_FLAG
                });
            }
        } catch (responseError) {
            logger.error('Error responding to failed button interaction:', responseError);
        }
    }
}

export { handleButton };