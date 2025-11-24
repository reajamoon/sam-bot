
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import logger from '../../../../../shared/utils/logger.js';
import { buildButtonId } from '../../../../../shared/utils/buttonId.js';
import { parseProfileSettingsCustomId, getProfileOwnerIdFromInteraction, buildProfileSettingsDoneCustomId, buildModalCustomId, buildSelectMenuCustomId, buildInputCustomId } from '../../../../../shared/utils/messageTracking.js';

// Centralized builder for profile settings buttons
function buildProfileSettingsButtonId(action, userId, messageId) {
    return buildButtonId({
        action,
        context: 'profile_settings',
        primaryId: userId,
        secondaryId: messageId
    });
}

function buildProfileSettingsDoneButtonId(userId, messageId) {
    return buildButtonId({
        action: 'done',
        context: 'profile_settings',
        primaryId: userId,
        secondaryId: messageId
    });
}

export async function handleSettingsMenu(interaction) {
    // message tracking
    const { getProfileMessageId, buildProfileButtonId } = await import('../../../../../shared/utils/messageTracking.js');
    const profileOwnerId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Debug logging for diagnosis
    logger.info(`[ProfileButtons] customId: ${interaction.customId}`);
    logger.info(`[ProfileButtons] extracted originalMessageId: ${originalMessageId}, actual userId: ${interaction.user.id}`);

    // Only trigger permission error if a valid user ID is present and mismatched
    if (profileOwnerId && profileOwnerId !== interaction.user.id) {
        logger.warn(`[ProfileButtons] Permission error: customId=${interaction.customId}, parsed userId=${profileOwnerId}, actual userId=${interaction.user.id}`);
        await interaction.reply({
            content: `**You can't edit someone else's profile!**\n\nTo edit your own profile, use:\n\`/profile\` - View and edit your profile\n\`/profile help\` - Learn about profile features`,
            flags: 64
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

    // Button ID helper
    const buildButtonCustomId = (action) => {
        return buildProfileButtonId(action, 'profile_settings', interaction.user.id, validatedMessageId || originalMessageId);
    };

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('set_birthday', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Set Birthday')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎂'),
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('set_bio', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Set Bio')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('set_timezone', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Set Timezone')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🌍'),
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('set_region', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Set Region')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🗺️'),
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('toggle_region_display', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Region Display')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👁️')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('set_pronouns', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Set Pronouns')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤'),
            new ButtonBuilder()
                .setCustomId(buildProfileSettingsButtonId('timezone_display', interaction.user.id, validatedMessageId || originalMessageId))
                .setLabel('Timezone Display')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
        );

    const doneButton = new ButtonBuilder()
        .setCustomId(buildProfileSettingsDoneCustomId(interaction.user.id, validatedMessageId || originalMessageId))
        .setLabel('Done')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

    const row3 = new ActionRowBuilder()
        .addComponents(doneButton);

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
        await interaction.update({
            embeds: [embed],
            components: [row1, row2, row3],
            content: ''
        });
    } else {
        await interaction.reply({
            embeds: [embed],
            components: [row1, row2, row3],
            flags: 64
        });
    }
}
