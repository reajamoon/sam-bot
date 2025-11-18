// Pure routing function for testability
const { InteractionFlags } = require('discord.js');
const { parseButtonId } = require('../../../../../shared/utils/buttonId');
function getHelpMenuPayload(customId) {
    const parsed = parseButtonId(customId);
    if (parsed && parsed.context === 'profile_help_menu') {
        const { InteractionFlags } = require('discord.js');
        const ephemeralFlag = InteractionFlags?.Ephemeral ?? 64;
        // Import modular help builders
    const { createBirthdayHelp } = require('../../../utils/profileHelpBirthday');
    const { createBioHelp } = require('../../../utils/profileHelpBio');
    const { createTimezoneRegionHelp } = require('../../../utils/profileHelpTimezoneRegion');
    const { createPrivacyHelp } = require('../../../utils/profileHelpPrivacy');
    const { createTipsHelp } = require('../../../utils/profileHelpTips');
    const { createProfileHelpMain } = require('../../../utils/profileHelp');

        // Create a mock interaction object for help builders
        const mockInteraction = {
            user: { id: parsed.primaryId },
            id: parsed.secondaryId,
            message: { id: parsed.secondaryId }
        };

        switch (parsed.action) {
            case 'birthday': {
                const { embed, components } = createBirthdayHelp(mockInteraction);
                return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
            }
            case 'bio': {
                const { embed, components } = createBioHelp(mockInteraction);
                return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
            }
            case 'timezone_region': {
                const { embed, components } = createTimezoneRegionHelp(mockInteraction);
                return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
            }
            case 'privacy': {
                const { embed, components } = createPrivacyHelp(mockInteraction);
                return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
            }
            case 'tips': {
                const { embed, components } = createTipsHelp(mockInteraction);
                return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
            }
            case 'main': {
                const { embed, components } = createProfileHelpMain(mockInteraction);
                return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
            }
            case 'done':
                return { type: 'close', content: '\u274c Help closed.', components: [], embeds: [], flags: ephemeralFlag, userId: parsed.primaryId, messageId: parsed.secondaryId };
        }
    }
    return null;
}

module.exports = { getHelpMenuPayload };
