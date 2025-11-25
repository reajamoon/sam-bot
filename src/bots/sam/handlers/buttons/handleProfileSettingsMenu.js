import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { buildProfileButtonId, buildProfileSettingsDoneCustomId, getProfileMessageId } from '../../../../shared/utils/messageTracking.js';
import logger from '../../../../shared/utils/logger.js';

/**
 * Handler for showing the main profile settings menu.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleProfileSettingsMenu(interaction) {
    logger.info(`[ProfileButtons] customId: ${interaction.customId}`);
    // message tracking
    let profileOwnerId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
    // Only trigger permission error if a valid user ID is present and mismatched
    // (This check is redundant since profileOwnerId is always interaction.user.id, but kept for logic parity)
    // If you want to check for editing someone else's profile, you need to parse the intended userId from the customId or message.
    // For now, this check will always pass.
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

    const embed = new EmbedBuilder()
        .setColor('#333333')
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
                flags: 64
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
