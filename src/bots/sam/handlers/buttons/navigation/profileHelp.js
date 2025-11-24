// Pure routing function for testability
import { InteractionFlags } from 'discord.js';
import { parseButtonId } from '../../../../../shared/utils/buttonId.js';
function getHelpMenuPayload(customId) {
    const parsed = parseButtonId(customId);
    if (parsed && parsed.context === 'profile_help_menu') {
        const ephemeralFlag = InteractionFlags?.Ephemeral ?? 64;
        // Import modular help builders
        // ESM imports at top
        import { createBirthdayHelp } from '../../../utils/profileHelpBirthday.js';
        import { createBioHelp } from '../../../utils/profileHelpBio.js';
        import { createTimezoneRegionHelp } from '../../../utils/profileHelpTimezoneRegion.js';
        import { createPrivacyHelp } from '../../../utils/profileHelpPrivacy.js';
        import { createTipsHelp } from '../../../utils/profileHelpTips.js';
        import { createProfileHelpMain } from '../../../utils/profileHelp.js';

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

export { getHelpMenuPayload };
