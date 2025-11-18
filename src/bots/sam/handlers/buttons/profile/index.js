const { handleSettingsMenu } = require('./settingsMenu');
const { handleTimezoneDisplay } = require('./timezoneDisplay');
const { handleBirthday } = require('./birthday');
const { handleRegionDisplay } = require('./regionDisplay');
const { handlePronouns } = require('./pronouns');
const { handleBio } = require('./bio');
const { handleRegion } = require('./region');
const { handleBackToProfileSettings } = require('./backToProfileSettings');

async function handleProfileButtons(interaction) {
        const logger = require('../../../../../shared/utils/logger');
        logger.info(`[handleProfileButtons] Invoked for customId: ${interaction.customId}`);
    if (interaction.customId === 'profile_settings' || 
        (interaction.customId.startsWith('profile_settings_') && !interaction.customId.startsWith('profile_settings_done_'))) {
        return handleSettingsMenu(interaction);
    }
    if (interaction.customId === 'profile_settings_done' || interaction.customId.startsWith('profile_settings_done_')) {
        // Route to main profileButtons.js handler for close logic
    const { handleProfileSettingsDone } = require('../profileButtons');
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
        const { handleTimezone } = require('./setTimezone');
        return handleTimezone(interaction);
    }
    // ...other handlers will be added here as modularization continues...
}

module.exports = { handleProfileButtons };
