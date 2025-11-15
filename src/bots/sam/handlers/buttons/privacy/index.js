
const { buildPrivacySettingsMenu } = require('./privacyMenu');
const handleToggleBirthdayMentions = require('./toggleBirthdayMentions');
const handleToggleBirthdayLists = require('./toggleBirthdayLists');
const handleTogglePrivacyModeFull = require('./togglePrivacyModeFull');
const handleTogglePrivacyModeAgeHidden = require('./togglePrivacyModeAgeHidden');
const handleToggleBirthdayHidden = require('./toggleBirthdayHidden');

module.exports = {
    buildPrivacySettingsMenu,
    handleToggleBirthdayMentions,
    handleToggleBirthdayLists,
    handleTogglePrivacyModeFull,
    handleTogglePrivacyModeAgeHidden,
    handleToggleBirthdayHidden,
};
