
import Discord from 'discord.js';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { buildButtonId } from '../../../../../shared/utils/buttonId.js';
import { buildPrivacySettingsDoneCustomId, encodeMessageId } from '../../../../../shared/utils/messageTracking.js';
import logger from '../../../../../shared/utils/logger.js';

async function buildPrivacySettingsButtonId(action, userId, messageId) {
    return await buildButtonId({
        action,
        context: 'privacy_settings',
        primaryId: userId,
        secondaryId: messageId
    });
}

async function buildPrivacySettingsDoneButtonId(userId, messageId) {
    return await buildButtonId({
        action: 'done',
        context: 'privacy_settings',
        primaryId: userId,
        secondaryId: messageId
    });
}

export async function buildPrivacySettingsMenu(userData, userId, messageId = null, validatedMessageId = null, interaction = null) {
    const menuTextsAll = (await import('../../../../../shared/text/menuTexts.json', { with: { type: 'json' } })).default;
    const menuTexts = menuTextsAll.privacy;
    const mentionsEnabled = userData.birthdayMentions !== false;
    const announcementsEnabled = userData.birthdayAnnouncements !== false;
    const privacyModeFull = userData.birthdayAgePrivacy === true;
    const privacyModeAgeHidden = userData.birthdayAgeOnly === true;
    const birthdayHidden = userData.birthdayHidden === true;
    const isPrivacyModeStrict = userData.birthdayYearHidden === true;

    // Strictly require validatedMessageId or messageId (must be original profile card message ID)
    let effectiveMsgId = validatedMessageId || messageId;
    if (!effectiveMsgId || !/^\d{17,19}$/.test(effectiveMsgId)) {
        logger.error('[PrivacyMenu] Missing or invalid original profile card message ID for menu builder', { validatedMessageId, messageId });
        throw new Error('PrivacyMenu: Missing or invalid original profile card message ID');
    }
    logger.debug('[PrivacyMenu] Using effectiveMsgId for encoding (should be original profile card message ID)', { effectiveMsgId });
    const encodedMsgId = encodeMessageId(effectiveMsgId);
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsButtonId('toggle_birthday_mentions', userId, encodedMsgId))
                .setLabel(mentionsEnabled ? menuTexts.birthdayMentionsOn : menuTexts.birthdayMentionsOff)
                .setStyle(mentionsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🎉'),
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsButtonId('toggle_birthday_lists', userId, encodedMsgId))
                .setLabel(announcementsEnabled ? menuTexts.dailyListsOn : menuTexts.dailyListsOff)
                .setStyle(announcementsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('📋')
        );

    const privacyFullButton = new ButtonBuilder()
        .setCustomId(await buildPrivacySettingsButtonId('toggle_privacy_mode_full', userId, encodedMsgId))
        .setLabel(privacyModeFull ? menuTexts.privacyModeFullOn : menuTexts.privacyModeFullOff)
        .setStyle(privacyModeFull ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🔒');
    if (isPrivacyModeStrict) privacyFullButton.setDisabled(true);

    const privacyAgeHiddenButton = new ButtonBuilder()
        .setCustomId(await buildPrivacySettingsButtonId('toggle_privacy_mode_age_hidden', userId, encodedMsgId))
        .setLabel(privacyModeAgeHidden ? menuTexts.privacyModeAgeHiddenOn : menuTexts.privacyModeAgeHiddenOff)
        .setStyle(privacyModeAgeHidden ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🎭');
    if (isPrivacyModeStrict) privacyAgeHiddenButton.setDisabled(true);

    const row2 = new ActionRowBuilder()
        .addComponents(
            privacyFullButton,
            privacyAgeHiddenButton
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsButtonId('toggle_birthday_hidden', userId, encodedMsgId))
                .setLabel(birthdayHidden ? menuTexts.profileBirthdayHidden : menuTexts.profileBirthdayVisible)
                .setStyle(birthdayHidden ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setEmoji('👻'),
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsDoneButtonId(userId, encodedMsgId))
                .setLabel(menuTexts.closeSettings)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
        );

    // Minimal embed for message tracking and dual update validation
    const embed = {
        title: 'Privacy Settings',
        description: 'Manage your profile birthday and privacy settings.',
        fields: [
            { name: 'User ID', value: userId },
            { name: 'Birthday Hidden', value: String(userData.birthdayHidden ?? false) }
        ]
    };
    return { components: [row1, row2, row3], embeds: [embed] };
}
