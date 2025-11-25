import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { buildButtonId } from '../../../../shared/utils/buttonId.js';

/**
 * Handler for the back to profile settings button, reconstructs the profile settings menu.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleBackToProfileSettings(interaction) {
    const { customId, user, message, client } = interaction;
    const parsed = customId.includes('_') ? customId.split('_') : [];
    const targetUserId = parsed.length >= 3 ? parsed[2] : user.id;
    let originalMessageId = parsed.length >= 4 ? parsed[3] : (message?.id || null);
    // Validate the messageId if provided
    let validatedMessageId = null;
    if (originalMessageId) {
        try {
            const msg = await interaction.channel.messages.fetch(originalMessageId);
            if (msg && msg.author.id === client.user.id) {
                validatedMessageId = originalMessageId;
            }
        } catch (error) {
            // If not valid, treat as new session
        }
    } else {
        validatedMessageId = message?.id || null;
    }
    // Build custom IDs with validated message tracking
    const buildButtonCustomId = async (action) => {
        return await buildButtonId({
            action,
            context: 'profile_settings',
            primaryId: user.id,
            secondaryId: validatedMessageId
        });
    };
    // Recreate the Profile Settings menu (ephemeral only)
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('set_birthday'))
                .setLabel('Set Birthday')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎂'),
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('set_bio'))
                .setLabel('Set Bio')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('set_timezone'))
                .setLabel('Set Timezone')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🌍'),
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('set_region'))
                .setLabel('Set Region')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🗺️'),
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('toggle_region_display'))
                .setLabel('Region Display')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👁️')
        );
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('set_pronouns'))
                .setLabel('Set Pronouns')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤'),
            new ButtonBuilder()
                .setCustomId(await buildButtonCustomId('timezone_display'))
                .setLabel('Timezone Display')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
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
        .addFields({ name: '✨ Changes will update your profile automatically', value: '*edits*', inline: false });
    await interaction.update({
        embeds: [embed],
        components: [row1, row2]
    });
}
