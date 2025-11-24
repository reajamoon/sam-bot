
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import logger from '../../../../../shared/utils/logger.js';
import { buildButtonId, parseButtonId } from '../../../../../shared/utils/buttonId.js';

export async function handleBackToProfileSettings(interaction) {
    const { getProfileMessageId, buildProfileButtonId } = await import('../../../../../shared/utils/messageTracking.js');
    const targetUserId = interaction.user.id;
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);
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
        validatedMessageId = interaction.message?.id || null;
        logger.info(`[BackToProfileSettings] No originalMessageId provided, fallback to interaction.message.id: ${validatedMessageId}`);
    }
    // Build custom IDs with validated message tracking
    const buildButtonCustomId = (action) => {
        return buildProfileButtonId(action, 'profile_settings', interaction.user.id, validatedMessageId);
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
}
