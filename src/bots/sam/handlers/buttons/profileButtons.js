const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, InteractionFlags } = require('discord.js');
const { User } = require('../../../../models');
const logger = require('../../../../shared/utils/logger');
const { parseProfileSettingsCustomId, buildModalCustomId, buildSelectMenuCustomId, buildInputCustomId, buildProfileSettingsDoneCustomId, decodeMessageId } = require('../../../../shared/utils/messageTracking');

// Removed legacy updateProfileAndMenu. All dual updates should use performDualUpdate from dualUpdate.js.

/**
 * Handle profile-related button interactions
 */


// Export the profile_settings_done handler as a separate function
async function handleProfileSettingsDone(interaction) {
    // Profile Settings Done button logic
    const logger = require('../../../../shared/utils/logger');
    logger.info(`[ProfileSettingsDone] Received customId: ${interaction.customId}`);
    // Robustly extract userId and messageId using utility (supports base64 encoding)
    const { parseProfileSettingsCustomId, decodeMessageId } = require('../../../../shared/utils/messageTracking');
    let profileOwnerId = null;
    let originalMessageId = null;
    const parsed = parseProfileSettingsCustomId(interaction.customId);
    if (parsed && parsed.userId && parsed.messageId) {
        profileOwnerId = parsed.userId;
        // If messageId looks base64, decode it
        originalMessageId = /^[A-Za-z0-9+/=]+$/.test(parsed.messageId) && parsed.messageId.length > 16
            ? decodeMessageId(parsed.messageId)
            : parsed.messageId;
    }
    logger.info(`[ProfileSettingsDone] Parsed userId: ${profileOwnerId}, messageId: ${originalMessageId}`);
    // Use navigation utility for close logic
    const { handleInteractionNavigation } = require('../../../../shared/utils/interactionNavigation');
    await handleInteractionNavigation(interaction, {
        type: 'close',
        content: '✅ Profile Settings closed.',
        components: [],
        embeds: []
    });
    // Profile Settings main menu
    if (interaction.customId === 'profile_settings' ||
        (interaction.customId.startsWith('profile_settings_') && !interaction.customId.startsWith('profile_settings_done_'))) {

    // message tracking
    const { getProfileMessageId, buildProfileButtonId } = require('../../../../shared/utils/messageTracking');
    let profileOwnerId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

        // Debug logging for diagnosis
        logger.info(`[ProfileButtons] customId: ${interaction.customId}`);
        logger.info(`[ProfileButtons] parsed userId: ${trackedData ? trackedData.userId : 'undefined'}, parsed messageId: ${trackedData ? trackedData.messageId : 'undefined'}, actual userId: ${interaction.user.id}`);

        // Only trigger permission error if a valid user ID is present and mismatched
        if (profileOwnerId && profileOwnerId !== interaction.user.id) {
            logger.warn(`[ProfileButtons] Permission error: customId=${interaction.customId}, parsed userId=${profileOwnerId}, actual userId=${interaction.user.id}`);
            await interaction.reply({
                content: `**You can't edit someone else's profile!**\n\nTo edit your own profile, use:\n\`/profile\` - View and edit your profile\n\`/profile help\` - Learn about profile features`,
                flags: InteractionFlags.Ephemeral
            });
            return;
        }

        // Validate that the original message still exists and belongs to this user
        let validatedMessageId = originalMessageId;
        if (originalMessageId) {
            try {
                const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed || !originalEmbed.fields) {
                    logger.warn(`Profile Settings: Original message ${originalMessageId} has no embed fields, treating as stale`);
                    validatedMessageId = null;
                } else {
                    const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                    if (!userIdField || userIdField.value !== interaction.user.id) {
                        logger.warn(`Profile Settings: Original message ${originalMessageId} belongs to different user, treating as stale`);
                        validatedMessageId = null;
                    }
                }
            } catch (fetchError) {
                logger.warn(`Profile Settings: Could not fetch original message ${originalMessageId}, treating as stale:`, fetchError);
                validatedMessageId = null;
            }
        }

        // Show profile settings menu with all the profile editing options

        // build all button custom IDs
        const buildButtonCustomId = (action) => {
            return buildProfileButtonId(action, 'profile_settings', interaction.user.id, validatedMessageId || originalMessageId);
        };

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('set_birthday'))
                    .setLabel('Set Birthday')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎂'),
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('set_bio'))
                    .setLabel('Set Bio')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('set_timezone'))
                    .setLabel('Set Timezone')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🌍'),
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('set_region'))
                    .setLabel('Set Region')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🗺️'),
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('toggle_region_display'))
                    .setLabel('Region Display')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👁️')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('set_pronouns'))
                    .setLabel('Set Pronouns')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId(buildButtonCustomId('timezone_display'))
                    .setLabel('Timezone Display')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buildProfileSettingsDoneCustomId(interaction.user.id, validatedMessageId || originalMessageId))
                    .setLabel('Close Profile Settings')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✅')
            );

        const settingsContent = '⚙️ **Profile Settings**\n\n' +
               'Choose what you\'d like to update on your profile:\n\n' +
               '🎂 **Birthday** - Set your birthday (with or without birth year)\n' +
               '📝 **Bio** - Write a short description about yourself\n' +
               '🌍 **Timezone** - Set your current timezone\n' +
               '🗺️ **Region** - Set your country, region, or timezone area\n' +
               '👤 **Pronouns** - Set your preferred pronouns\n' +
               '⚙️ **Timezone Display** - Choose how your timezone appears\n\n' +
               'Click any button to edit that setting!' +
               (validatedMessageId ? '\n\n✨ *Changes will update your profile automatically*' : '\n\n⚠️ *Profile auto-update unavailable - message tracking lost*');

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('⚙️ Profile Settings')
            .setDescription('Choose what you\'d like to update on your profile:')
            .addFields(
                { name: '🎂 Birthday', value: 'Set your birthday (with or without birth year)', inline: true },
                { name: '📝 Bio', value: 'Write a short description about yourself', inline: true },
                { name: '🌍 Timezone', value: 'Set your current timezone', inline: true },
                { name: '🗺️ Region', value: 'Set your country, region, or timezone area', inline: true },
                { name: '👤 Pronouns', value: 'Set your preferred pronouns', inline: true },
                { name: '⚙️ Timezone Display', value: 'Choose how your timezone appears', inline: true }
            )
            .setFooter({ text: 'Click any button to edit that setting!' })
            .addFields({
                name: validatedMessageId ? '✨ Changes will update your profile automatically' : '⚠️ Profile auto-update unavailable',
                value: validatedMessageId ? '*Your profile will refresh when you make changes*' : '*Message tracking lost - changes saved but profile won\'t auto-refresh*',
                inline: false
            });

        // Check if this is being called from a back button (message is ephemeral and being updated)
        // vs. initial Profile Settings click (need to create new ephemeral message)
        const isBackButton = interaction.message && interaction.message.flags && interaction.message.flags.has('Ephemeral');

        if (isBackButton) {
            // Update existing ephemeral message (back button from modal)
            if (typeof interaction.update === 'function') {
                await interaction.update({
                    embeds: [embed],
                    components: [row1, row2, row3]
                });
            } else {
                logger.error('interaction.update is not a function', { customId: interaction.customId });
                await interaction.reply({
                    content: 'Could not update the message. Please try again.',
                    flags: InteractionFlags.Ephemeral || 64
                });
            }
        } else {
            // Create new ephemeral message (initial Profile Settings click)
            await interaction.reply({
                embeds: [embed],
                components: [row1, row2, row3],
                flags: 64
            });
        }
    }

    // Profile Settings Done button
    else if (interaction.customId === 'profile_settings_done' || interaction.customId.startsWith('profile_settings_done_')) {
    const logger = require('../../../../shared/utils/logger');
    logger.info(`[ProfileSettingsDone] Received customId: ${interaction.customId}`);
    logger.info(`[ProfileSettingsDone] Parsed userId: ${profileOwnerId}, messageId: ${originalMessageId}`);
        // Robustly extract userId and messageId using utility (supports base64 encoding)
        const { parseProfileSettingsCustomId, decodeMessageId } = require('../../../../shared/utils/messageTracking');
        let profileOwnerId = null;
        let originalMessageId = null;
        const parsed = parseProfileSettingsCustomId(interaction.customId);
        if (parsed && parsed.userId && parsed.messageId) {
            profileOwnerId = parsed.userId;
            // If messageId looks base64, decode it
            originalMessageId = /^[A-Za-z0-9+/=]+$/.test(parsed.messageId) && parsed.messageId.length > 16
                ? decodeMessageId(parsed.messageId)
                : parsed.messageId;
        }

        // Use navigation utility for close logic
        const { handleInteractionNavigation } = require('../../../../shared/utils/interactionNavigation');
        await handleInteractionNavigation(interaction, {
            type: 'close',
            content: '✅ Profile Settings closed.',
            components: [],
            embeds: []
        });
    }

    // Timezone Display Settings
    else if (interaction.customId === 'timezone_display' || interaction.customId.startsWith('timezone_display_')) {
        // Extract profile owner ID if present (new format)
        const profileOwnerId = interaction.customId.includes('_') ? interaction.customId.split('_')[2] : null;

        // Permission check removed: parent menu is ephemeral and only accessible by the user

        // Show timezone display preference menu
        // Extract message ID from the button's custom ID to preserve it for dual updates
        const menuParts = interaction.customId.split('_');
        const messageId = menuParts.length >= 4 ? menuParts[3] : '';

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`timezone_display_select_${messageId}`)
            .setPlaceholder('Choose how to display your timezone')
            .addOptions([
                {
                    label: 'Full Name (America/New_York)',
                    description: 'Show the complete IANA timezone name',
                    value: 'iana',
                    emoji: '🌍'
                },
                {
                    label: 'UTC Offset (UTC-5)',
                    description: 'Show as UTC offset from Greenwich',
                    value: 'offset',
                    emoji: '⏰'
                },
                {
                    label: 'Short Code (EST)',
                    description: 'Show just the timezone abbreviation',
                    value: 'short',
                    emoji: '🏷️'
                },
                {
                    label: 'Combined (UTC-08:00) Pacific Time',
                    description: 'Show offset and readable name together',
                    value: 'combined',
                    emoji: '🕐'
                },
                {
                    label: 'Hidden',
                    description: 'Don\'t show timezone on your profile',
                    value: 'hidden',
                    emoji: '🚫'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Extract message ID from button custom ID to preserve it for back button
        const { buildButtonId } = require('../../../../shared/utils/buttonId');
        // Use centralized builder for Back to Profile Settings button
        const backButtonCustomId = buildButtonId({
            action: 'back_to_profile_settings',
            context: 'profile_settings',
            primaryId: interaction.user.id,
            secondaryId: messageId || ''
        });
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(backButtonCustomId)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
            );

        await interaction.update({
            content: '⚙️ **Timezone Display Preferences**\nChoose how you want your timezone to appear on your profile:',
            components: [row, backButton],
            embeds: []
        });
    }

    // Set birthday buttons
    else if (interaction.customId === 'set_birthday' || interaction.customId.startsWith('set_birthday_')) {
        // Extract userId and messageId if this is from tracked profile settings
        const parts = interaction.customId.split('_');
        const targetUserId = parts.length >= 3 ? parts[2] : interaction.user.id;
        const originalMessageId = parts.length >= 4 ? parts[3] : null;

        // Permission check removed: parent menu is ephemeral and only accessible by the user

        // Build modal custom ID with message tracking if available
        const modalCustomId = originalMessageId ? `birthday_modal_${originalMessageId}` : 'birthday_modal';

        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('Set Your Birthday');

        const birthdayInput = new TextInputBuilder()
            .setCustomId('birthday_input')
            .setLabel('Birthday (MM/DD or MM/DD/YYYY)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Examples: 12/25, 12/25/1995, or 12/25/95')
            .setRequired(true)
            .setMaxLength(10);

        const firstActionRow = new ActionRowBuilder().addComponents(birthdayInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }

    // Confirm set birthday (legacy - may not be used anymore)
    else if (interaction.customId === 'confirm_set_birthday') {
        await interaction.update({
            content: '✅ **Birthday confirmed!** Your profile has been updated.',
            components: []
        });
    }

    // Set timezone buttons
    logger.info(`[DEBUG] Checking set_timezone handler condition: customId=${interaction.customId}, eq=${interaction.customId === 'set_timezone'}, startsWith=${interaction.customId.startsWith('set_timezone_')}`);
    if (interaction.customId === 'set_timezone' || interaction.customId.startsWith('set_timezone_')) {
        // Extract userId and messageId if this is from tracked profile settings
        const parts = interaction.customId.split('_');
        const targetUserId = parts.length >= 3 ? parts[2] : interaction.user.id;
        const originalMessageId = parts.length >= 4 ? parts[3] : null;

        // Permission check removed: parent menu is ephemeral and only accessible by the user

        // Build modal custom ID with message tracking if available
        const { buildModalCustomId } = require('../../../../shared/utils/messageTracking');
        const modalCustomId = buildModalCustomId('timezone', originalMessageId);
        logger.info(`[SetTimezoneButton] Preparing to show modal. modalCustomId: ${modalCustomId}, originalMessageId: ${originalMessageId}`);
        logger.info(`[SetTimezoneButton] interaction.isButton: ${typeof interaction.isButton === 'function' ? interaction.isButton() : 'not a function'}`);
        logger.info(`[SetTimezoneButton] typeof interaction.showModal: ${typeof interaction.showModal}`);
        logger.info(`[SetTimezoneButton] interaction type: ${interaction.type}`);
        logger.info(`[SetTimezoneButton] interaction object keys: ${Object.keys(interaction)}`);

        logger.info('[SetTimezoneButton] Before modal creation');
        let modalError = null;
        try {
            logger.info('[SetTimezoneButton] Creating modal');
            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('Set Your Timezone');

            const timezoneInput = new TextInputBuilder()
                .setCustomId('timezone_input')
                .setLabel('Timezone (City, UTC offset, or abbreviation)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Examples: New York, UTC-5, EST, Los Angeles')
                .setRequired(true)
                .setMaxLength(50);

            const firstActionRow = new ActionRowBuilder().addComponents(timezoneInput);
            modal.addComponents(firstActionRow);
            logger.info('[SetTimezoneButton] After modal creation, before showModal');
            logger.info(`[SetTimezoneButton] About to call interaction.showModal for modalCustomId: ${modalCustomId}`);
            await interaction.showModal(modal);
            logger.info('[SetTimezoneButton] After showModal call');
            logger.info(`[SetTimezoneButton] showModal called successfully for modalCustomId: ${modalCustomId}`);
        } catch (err) {
            modalError = err;
            logger.error(`[SetTimezoneButton] Exception thrown by interaction.showModal for modalCustomId: ${modalCustomId}, originalMessageId: ${originalMessageId}. Error: ${err && err.stack ? err.stack : err}`);
        }
        if (modalError) {
            try {
                await interaction.reply({
                    content: '❌ Something went wrong showing the timezone modal. Please try again or contact Sam.',
                    flags: InteractionFlags.Ephemeral || 64
                });
            } catch (replyError) {
                logger.error(`[SetTimezoneButton] Failed to send fallback reply after modal error: ${replyError && replyError.stack ? replyError.stack : replyError}`);
            }
        }
    }

    // Set pronouns buttons
    else if (interaction.customId === 'set_pronouns' || interaction.customId.startsWith('set_pronouns_')) {
        // Extract userId and messageId if this is from tracked profile settings
        const parts = interaction.customId.split('_');
        const targetUserId = parts.length >= 3 ? parts[2] : interaction.user.id;
        const originalMessageId = parts.length >= 4 ? parts[3] : null;

        // Security check: only allow editing own profile
        // Permission check removed: parent menu is ephemeral and only accessible by the user

        // Build modal custom ID with message tracking if available
        const modalCustomId = originalMessageId ? `pronouns_modal_${originalMessageId}` : 'pronouns_modal';

        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('Set Your Pronouns');

        const pronounsInput = new TextInputBuilder()
            .setCustomId('pronouns_input')
            .setLabel('Pronouns')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Examples: they/them, she/her, he/him, any pronouns')
            .setRequired(true)
            .setMaxLength(50);

        const firstActionRow = new ActionRowBuilder().addComponents(pronounsInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }

    // Confirm set pronouns (legacy - may not be used anymore)
    else if (interaction.customId === 'confirm_set_pronouns') {
        await interaction.update({
            content: '✅ **Pronouns confirmed!** Your profile has been updated.',
            components: []
        });
    }

    // Set bio buttons
    else if (interaction.customId === 'set_bio' || interaction.customId.startsWith('set_bio_')) {
        const { parseButtonId } = require('../../../../shared/utils/buttonId');
        const parsed = parseButtonId(interaction.customId);
        const targetUserId = parsed ? parsed.primaryId : interaction.user.id;
        const originalMessageId = parsed ? parsed.secondaryId : null;

        // Permission check removed: parent menu is ephemeral and only accessible by the user

        // Build modal custom ID with message tracking if available
        const modalCustomId = originalMessageId ? `bio_modal_${originalMessageId}` : 'bio_modal';

        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('Set Your Bio');

        const bioInput = new TextInputBuilder()
            .setCustomId('bio_input')
            .setLabel('Bio (1000 characters max)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Tell us about yourself! Interests, fandoms, anything you want to share.')
            .setRequired(true)
            .setMaxLength(1000);

        const firstActionRow = new ActionRowBuilder().addComponents(bioInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }

    // Confirm set bio (legacy - may not be used anymore)
    else if (interaction.customId === 'confirm_set_bio') {
        await interaction.update({
            content: '✅ **Bio confirmed!** Your profile has been updated.',
            components: []
        });
    }

    // Set region buttons
    else if (interaction.customId === 'set_region' || interaction.customId.startsWith('set_region_')) {
        const { parseButtonId } = require('../../../../shared/utils/buttonId');
        const parsed = parseButtonId(interaction.customId);
        const targetUserId = parsed ? parsed.primaryId : interaction.user.id;
        const originalMessageId = parsed ? parsed.secondaryId : null;

        // Permission check removed: parent menu is ephemeral and only accessible by the user

        // Build modal custom ID with message tracking if available
        const modalCustomId = originalMessageId ? `region_modal_${originalMessageId}` : 'region_modal';

        // Create region modal
        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('Set Your Region');

        const regionInput = new TextInputBuilder()
            .setCustomId('region_input') // Always static, do not append messageId
            .setLabel('Region, Country, or Timezone Area')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., California, Canada, Japan, Europe, Pacific Time')
            .setRequired(false)
            .setMaxLength(50);

        const firstActionRow = new ActionRowBuilder().addComponents(regionInput);
        modal.addComponents(firstActionRow);

        logger.info(`[RegionModal] Showing modal with customId: ${modalCustomId}, expecting field: region_input`);
        await interaction.showModal(modal);
        logger.info(`[RegionModal] showModal called for user: ${interaction.user.id}`);
    }

    // Toggle region display
    else if (interaction.customId === 'toggle_region_display' || interaction.customId.startsWith('toggle_region_display_')) {
    const { parseButtonId } = require('../../../../shared/utils/buttonId');
    const parsed = parseButtonId(interaction.customId);
    const targetUserId = parsed ? parsed.primaryId : interaction.user.id;
    // Always propagate original profile message ID, fallback to interaction.message.id if missing
    let originalMessageId = parsed && parsed.secondaryId ? parsed.secondaryId : (interaction.message?.id || null);


        try {
            const User = require('../../../../models').User;
            const user = await User.findByPk(interaction.user.id);

            if (!user) {
                return await interaction.reply({
                    content: '❌ **User not found in database.**',
                    flags: 64
                });
            }

            // Toggle region display setting
            const newRegionDisplay = !user.regionDisplay;
            await user.update({ regionDisplay: newRegionDisplay });

            // Create confirmation message
            const statusText = newRegionDisplay ? 'shown' : 'hidden';
            const description = newRegionDisplay
                ? '✅ **Region will now be shown in your profile.**\n\n' +
                  (user.timezoneHidden ?
                    'Since your timezone is hidden, region will appear as a separate field.' :
                    'Region will appear under your timezone field.')
                : '❌ **Region is now hidden from your profile.**';

            const confirmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔧 Profile Settings - Region Display')
                .setDescription(description)
                .setFooter({
                    text: `Region Display: ${statusText}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Always use the original profile message ID for back button after toggle
            const { buildButtonId } = require('../../../../shared/utils/buttonId');
            // If originalMessageId is present, use it; otherwise, fallback to previous context
            let propagatedMessageId = originalMessageId;
            if (!propagatedMessageId && interaction.message?.id) {
                // If we lost the original, fallback to previous context
                propagatedMessageId = interaction.message.id;
            }
            const backButtonCustomId = buildButtonId({
                action: 'back_to_profile_settings',
                context: 'profile_settings',
                primaryId: interaction.user.id,
                secondaryId: propagatedMessageId
            });
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(backButtonCustomId)
                        .setLabel('← Back to Profile Settings')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

            // Use dual update utility for cleaner code
            const { performDualUpdate } = require('../../../utils/dualUpdate');

            const ephemeralResponse = {
                embeds: [confirmEmbed],
                components: [backButton]
            };

            // If this is a button interaction from an ephemeral message, update instead of reply
            if (interaction.isButton() && interaction.message && interaction.message.flags?.has('Ephemeral')) {
                await interaction.update(ephemeralResponse);
                // Also update the original profile message in the background
                const { updateOriginalProfile } = require('../../../utils/updateOriginalProfile');
                await updateOriginalProfile(interaction, originalMessageId, 'region display toggle');
            } else {
                await performDualUpdate(
                    interaction,
                    ephemeralResponse,
                    originalMessageId,
                    'region display toggle'
                );
            }

        } catch (error) {
            console.error('Error handling region display toggle:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while updating your region display setting. Please try again.')
                .setTimestamp();

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(originalMessageId ? `back_to_profile_settings_${interaction.user.id}_${originalMessageId}` : 'back_to_profile_settings')
                        .setLabel('← Back to Profile Settings')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

            if (interaction.message && interaction.message.flags?.has('Ephemeral')) {
                await interaction.update({
                    embeds: [errorEmbed],
                    components: [backButton]
                });
            } else {
                await interaction.reply({
                    embeds: [errorEmbed],
                    components: [backButton],
                    flags: 64
                });
            }
        }
    }

    // Back to Profile Settings button
    else if (interaction.customId === 'back_to_profile_settings' || interaction.customId.startsWith('back_to_profile_settings_')) {
    console.log('[DEBUG] back_to_profile_settings handler triggered, customId:', interaction.customId);
    const { parseButtonId } = require('../../../../shared/utils/buttonId');
    const parsed = parseButtonId(interaction.customId);
    const targetUserId = parsed ? parsed.primaryId : interaction.user.id;
    // Always propagate original profile message ID, fallback to interaction.message.id if missing
    let originalMessageId = parsed && parsed.secondaryId ? parsed.secondaryId : (interaction.message?.id || null);

        // Simply redirect to profile settings by reconstructing the profile settings flow
        try {
            // Debug logging for diagnosis
            logger.info(`[BackToProfileSettings] customId: ${interaction.customId}`);
            logger.info(`[BackToProfileSettings] parsed userId: ${targetUserId}, parsed messageId: ${originalMessageId}, actual userId: ${interaction.user.id}`);


            // Validate the messageId if provided
            let validatedMessageId = null;
            if (originalMessageId) {
                try {
                    const message = await interaction.channel.messages.fetch(originalMessageId);
                    if (message && message.author.id === interaction.client.user.id) {
                        validatedMessageId = originalMessageId;
                        logger.info(`[BackToProfileSettings] Successfully validated message ID ${originalMessageId}`);
                    } else {
                        logger.warn(`[BackToProfileSettings] Message ${originalMessageId} not from bot, treating as new session`);
                    }
                } catch (error) {
                    logger.warn(`[BackToProfileSettings] Could not validate message ${originalMessageId}, treating as new session: ${error.message}`);
                }
            } else {
                // Fallback to current interaction message ID
                validatedMessageId = interaction.message?.id || null;
                logger.info(`[BackToProfileSettings] No originalMessageId provided, fallback to interaction.message.id: ${validatedMessageId}`);
            }

            // Build custom IDs with validated message tracking
            // Use centralized buildButtonId utility for all menu buttons
            const { buildButtonId } = require('../../../../shared/utils/buttonId');
            const buildButtonCustomId = (action) => {
                // Always include validated/original profile message ID for all buttons
                return buildButtonId({
                    action,
                    context: 'profile_settings',
                    primaryId: interaction.user.id,
                    secondaryId: validatedMessageId
                });
            };

            // Recreate the Profile Settings menu (ephemeral only)
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('set_birthday'))
                        .setLabel('Set Birthday')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🎂'),
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('set_bio'))
                        .setLabel('Set Bio')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('set_timezone'))
                        .setLabel('Set Timezone')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🌍'),
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('set_region'))
                        .setLabel('Set Region')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🗺️'),
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('toggle_region_display'))
                        .setLabel('Region Display')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👁️')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('set_pronouns'))
                        .setLabel('Set Pronouns')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👤'),
                    new ButtonBuilder()
                        .setCustomId(buildButtonCustomId('timezone_display'))
                        .setLabel('Timezone Display')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Profile Settings')
                .setDescription('Choose what you\'d like to update on your profile:')
                .addFields(
                    { name: '🎂 Birthday', value: 'Set your birthday (with or without birth year)', inline: true },
                    { name: '📝 Bio', value: 'Write a short description about yourself', inline: true },
                    { name: '🌍 Timezone', value: 'Set your current timezone', inline: true },
                    { name: '🗺️ Region', value: 'Set your country, region, or timezone area', inline: true },
                    { name: '👤 Pronouns', value: 'Set your preferred pronouns', inline: true },
                    { name: '⚙️ Timezone Display', value: 'Choose how your timezone appears', inline: true }
                )
                .setFooter({ text: 'Click any button to edit that setting!' })
                .addFields({ name: '✨ Changes will update your profile automatically', value: '*edits*', inline: false });

            // Always update the ephemeral message for navigation
            await interaction.update({
                embeds: [embed],
                components: [row1, row2]
            });

        } catch (error) {
            console.error('Error handling back to profile settings:', error);
            await interaction.reply({
                content: '❌ **Error returning to Profile Settings.**\n\nPlease try using `/profile` again.',
                flags: 64
            });
        }
    }
}

// Modularized profile button handlers
const { handleProfileButtons } = require('./profile');

module.exports = { handleProfileButtons, handleProfileSettingsDone };