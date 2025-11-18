const { User } = require('../../../../models');
const logger = require('../../../../shared/utils/logger');

/**
 * Handle timezone modal submission
 * @param {Object} interaction - Discord modal interaction
 * @param {string} originalMessageId - Optional original profile message ID for dual updates
 */
async function handleTimezoneModal(interaction, originalMessageId = null) {
    logger.info(`=== TIMEZONE MODAL START === User: ${interaction.user.tag}, CustomId: ${interaction.customId}`);
    // Extract originalMessageId from customId if not provided
    if (!originalMessageId) {
    const { getProfileMessageId } = require('../../../shared/utils/messageTracking');
        originalMessageId = getProfileMessageId(interaction, interaction.customId);
    }

    // Detect if modal was submitted from an ephemeral message
    const isEphemeralContext = interaction.message && interaction.message.flags && interaction.message.flags.has('Ephemeral');

    // Only deferReply if not ephemeral context
    if (!isEphemeralContext) {
    const { MessageFlags } = require('discord.js');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    const timezoneInput = interaction.fields.getTextInputValue('timezone_input').trim();
    logger.info(`Timezone Modal: timezoneInput = "${timezoneInput}"`);

    // Helper to build back button with correct ID
    const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
    const buildBackButton = (msgId = originalMessageId) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(msgId ? `profile_settings_${interaction.user.id}_${msgId}` : `profile_settings_${interaction.user.id}`)
                .setLabel('← Back to Profile Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
        );
    };

    // Validation: empty
    if (!timezoneInput) {
        if (isEphemeralContext) {
            await interaction.update({
                content: '❌ **Timezone cannot be empty!**\n\nPlease try again with a valid timezone.',
                components: [buildBackButton()],
                embeds: []
            });
        } else {
            await interaction.editReply({
                content: '❌ **Timezone cannot be empty!**\n\nPlease try again with a valid timezone.',
                components: [buildBackButton()],
                embeds: []
            });
        }
        return;
    }
    // Validation: too short
    if (timezoneInput.length < 2) {
        if (isEphemeralContext) {
            await interaction.update({
                content: 'Timezone must be at least 2 characters long. Please enter a valid timezone.',
                components: [buildBackButton()],
                embeds: []
            });
        } else {
            await interaction.editReply({
                content: 'Timezone must be at least 2 characters long. Please enter a valid timezone.',
                components: [buildBackButton()],
                embeds: []
            });
        }
        return;
    }

    // Validate timezone using the new region-based validator
    const { validateTimezone } = require('../../../shared/utils/timezoneValidator');
    const validation = validateTimezone(timezoneInput);

    if (!validation.isValid) {
        let errorMessage = `❌ **Invalid timezone: "${timezoneInput}"**\n\n` +
            `Please try:\n` +
            `• **Locations**: New York, London, Tokyo, California\n` +
            `• **Abbreviations**: PST, EST, CST, GMT\n` +
            `• **UTC offsets**: +5, -8, UTC+2\n`;
        if (validation.suggestions && validation.suggestions.length > 0) {
            errorMessage += `\n**Did you mean?**\n${validation.suggestions.map(s => `• ${s}`).join('\n')}`;
        }
        if (isEphemeralContext) {
            await interaction.update({
                content: null,
                components: [buildBackButton()],
                embeds: [
                    {
                        title: 'Timezone Error',
                        description: errorMessage
                    }
                ]
            });
        } else {
            await interaction.editReply({
                content: null,
                components: [buildBackButton()],
                embeds: [
                    {
                        title: 'Timezone Error',
                        description: errorMessage
                    }
                ]
            });
        }
        return;
    }
    try {
        // Update or create user record with the validated timezone
        await User.upsert({
            discordId: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator || '0',
            avatar: interaction.user.avatar,
            timezone: validation.normalizedTimezone
        });

        // Try to show current time in their timezone for confirmation
        let currentTimePreview = '';
        try {
            const now = new Date();
            if (validation.normalizedTimezone.startsWith('UTC')) {
                currentTimePreview = `\n⏰ **Current time**: ${now.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} ${validation.normalizedTimezone}`;
            } else {
                const timeInZone = now.toLocaleString('en-US', {
                    timeZone: validation.normalizedTimezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZoneName: 'short'
                });
                currentTimePreview = `\n⏰ **Current time**: ${timeInZone}`;
            }
        } catch {}

        const responseMessage = `🌍 **Timezone set successfully!**\n\n` +
            `Your timezone has been set to: **${validation.normalizedTimezone}**${currentTimePreview}\n\n` +
            `✅ Your profile will now show your local time\n` +
            `✅ Others can see when it's a good time to chat\n` +
            `✅ You can change display format anytime\n\n` +
            `Use **Profile Settings** → **Timezone Display** to choose how it appears!`;

        if (isEphemeralContext) {
            await interaction.update({
                content: responseMessage,
                components: [buildBackButton()],
                embeds: []
            });
        } else {
            await interaction.editReply({
                content: responseMessage,
                components: [buildBackButton()],
                embeds: []
            });
        }

        logger.info(`[TimezoneModal] Sent success reply with originalMessageId: ${originalMessageId}`);
        logger.info(`Timezone Modal: Successfully updated interaction. About to attempt dual update with originalMessageId: ${originalMessageId}`);

        // If we have message tracking, try to update the original profile
        if (originalMessageId) {
            try {
                const channel = interaction.channel;
                const originalMessage = await channel.messages.fetch(originalMessageId);
                if (originalMessage) {
                    const originalEmbed = originalMessage.embeds[0];
                    if (originalEmbed && originalEmbed.fields) {
                        const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                        if (userIdField && userIdField.value === interaction.user.id) {
                            const profileOwnerUser = await interaction.client.users.fetch(interaction.user.id);
                            const [user] = await User.findOrCreate({
                                where: { discordId: interaction.user.id },
                                defaults: {
                                    discordId: interaction.user.id,
                                    username: profileOwnerUser.username,
                                    discriminator: profileOwnerUser.discriminator || '0',
                                    avatar: profileOwnerUser.avatar
                                }
                            });
                            const { generateProfileCard, createProfileButtons } = require('../../utils/profileCard');
                            const { embed } = await generateProfileCard(profileOwnerUser, user, interaction.client, interaction);
                            const profileButtons = createProfileButtons(interaction.user.id, interaction.user.id, originalMessageId);
                            await originalMessage.edit({
                                embeds: [embed],
                                components: profileButtons
                            });
                        }
                    }
                }
            } catch {}
        }
    } catch {
        if (isEphemeralContext) {
            await interaction.update({
                content: '❌ **Something went wrong saving your timezone.**\n\nPlease try again!',
                components: [buildBackButton()],
                embeds: []
            });
        } else {
            await interaction.editReply({
                content: '❌ **Something went wrong saving your timezone.**\n\nPlease try again!',
                components: [buildBackButton()],
                embeds: []
            });
        }
    }
}

module.exports = { handleTimezoneModal };