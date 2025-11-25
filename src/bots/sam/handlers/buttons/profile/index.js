
import { handleSettingsMenu } from './settingsMenu.js';

export async function handleProfileButtons(interaction) {
    const logger = (await import('../../../../../shared/utils/logger.js')).default;
    logger.info(`[handleProfileButtons] Invoked for customId: ${interaction.customId}`);
    if (interaction.customId === 'profile_settings' || 
        (interaction.customId.startsWith('profile_settings_') && !interaction.customId.startsWith('profile_settings_done_'))) {
        const { handleProfileSettingsMenu } = await import('../handleProfileSettingsMenu.js');
        return handleProfileSettingsMenu(interaction);
    }
    if (interaction.customId === 'profile_settings_done' || interaction.customId.startsWith('profile_settings_done_')) {
        const { handleProfileSettingsDone } = await import('../handleProfileSettingsDone.js');
        return handleProfileSettingsDone(interaction);
    }
    if (interaction.customId === 'timezone_display' || interaction.customId.startsWith('timezone_display_')) {
        const { handleTimezoneDisplay } = await import('../handleTimezoneDisplay.js');
        return handleTimezoneDisplay(interaction);
    }
    if (interaction.customId === 'set_birthday' || interaction.customId.startsWith('set_birthday_')) {
        const { handleBirthday } = await import('../handleBirthday.js');
        return handleBirthday(interaction);
    }
    if (interaction.customId === 'toggle_region_display' || interaction.customId.startsWith('toggle_region_display_')) {
        const { handleRegionDisplay } = await import('../handleRegionDisplay.js');
        return handleRegionDisplay(interaction);
    }
    if (interaction.customId === 'set_pronouns' || interaction.customId.startsWith('set_pronouns_')) {
        const { handlePronouns } = await import('../handlePronouns.js');
        return handlePronouns(interaction);
    }
    if (interaction.customId === 'set_bio' || interaction.customId.startsWith('set_bio_')) {
        const { handleBio } = await import('../handleBio.js');
        return handleBio(interaction);
    }
    if (interaction.customId === 'set_region' || interaction.customId.startsWith('set_region_')) {
        const { handleRegion } = await import('../handleRegion.js');
        return handleRegion(interaction);
    }
    if (interaction.customId === 'back_to_profile_settings' || interaction.customId.startsWith('back_to_profile_settings_')) {
        const { handleBackToProfileSettings } = await import('../handleBackToProfileSettings.js');
        return handleBackToProfileSettings(interaction);
    }
    if (interaction.customId === 'set_timezone' || interaction.customId.startsWith('set_timezone_')) {
        const { handleTimezone } = await import('../handleTimezone.js');
        return handleTimezone(interaction);
    }
    // ...other handlers will be added here as modularization continues...
}
