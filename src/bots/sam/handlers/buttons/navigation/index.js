import handleProfileHelp from '../../../commands/profile/helpHandler.js';
import { handleBackToProfile } from './backToProfile.js';

async function handleNavigationButtons(interaction) {
    const logger = (await import('../../../../../shared/utils/logger.js')).default;
    logger.info(`[handleNavigationButtons] Received interaction with customId=${interaction.customId}`);
    if (interaction.customId === 'profile_help' || interaction.customId === 'profile_help_main') {
        return handleProfileHelp(interaction);
    }
    if (interaction.customId === 'back_to_profile') {
        return handleBackToProfile(interaction);
    }
    // Modular help menu buttonId format
    if (/(_profile_help_menu_)/.test(interaction.customId)) {
    const { getHelpMenuPayload } = await import('./profileHelp.js');
        const payload = getHelpMenuPayload(interaction.customId);
        if (payload) {
            // If type is 'close', just update with empty content
            if (payload.type === 'close') {
                await interaction.update({ content: payload.content, components: [], embeds: [], flags: payload.flags });
            } else {
                await interaction.update({ embeds: payload.embeds, components: payload.components, flags: payload.flags });
            }
            return;
        }
    }
}

export { handleNavigationButtons };
