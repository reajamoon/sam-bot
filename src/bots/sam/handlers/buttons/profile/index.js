
import { handleSettingsMenu } from './settingsMenu.js';
import { handleTimezoneDisplay } from './timezoneDisplay.js';
import { handleBirthday } from './birthday.js';
import { handleRegionDisplay } from './regionDisplay.js';
import { handlePronouns } from './pronouns.js';
import { handleBio } from './bio.js';
import { handleRegion } from './region.js';
import { handleBackToProfileSettings } from './backToProfileSettings.js';

export async function handleProfileButtons(interaction) {
    const logger = (await import('../../../../../shared/utils/logger.js')).default;
    logger.info(`[handleProfileButtons] Invoked for customId: ${interaction.customId}`);
    if (interaction.customId === 'profile_settings' || 
        (interaction.customId.startsWith('profile_settings_') && !interaction.customId.startsWith('profile_settings_done_'))) {
        return handleSettingsMenu(interaction);
    }
    if (interaction.customId === 'profile_settings_done' || interaction.customId.startsWith('profile_settings_done_')) {
        // Route to main profileButtons.js handler for close logic
        const { handleProfileSettingsDone } = await import('../profileButtons.js');
        return handleProfileSettingsDone(interaction);
    }
    if (interaction.customId === 'timezone_display' || interaction.customId.startsWith('timezone_display_')) {
        return handleTimezoneDisplay(interaction);
    }
    if (interaction.customId === 'set_birthday' || interaction.customId.startsWith('set_birthday_')) {
        return handleBirthday(interaction);
    }
    if (interaction.customId === 'toggle_region_display' || interaction.customId.startsWith('toggle_region_display_')) {
        return handleRegionDisplay(interaction);
    }
    if (interaction.customId === 'set_pronouns' || interaction.customId.startsWith('set_pronouns_')) {
        return handlePronouns(interaction);
    }
    if (interaction.customId === 'set_bio' || interaction.customId.startsWith('set_bio_')) {
        return handleBio(interaction);
    }
    if (interaction.customId === 'set_region' || interaction.customId.startsWith('set_region_')) {
        return handleRegion(interaction);
    }
    if (interaction.customId === 'back_to_profile_settings' || interaction.customId.startsWith('back_to_profile_settings_')) {
        return handleBackToProfileSettings(interaction);
    }
    if (interaction.customId === 'set_timezone' || interaction.customId.startsWith('set_timezone_')) {
        const { handleTimezone } = await import('./setTimezone.js');
        return handleTimezone(interaction);
    }
    // ...other handlers will be added here as modularization continues...
}
