const { MessageFlags } = require('discord.js');
const { User } = require('../../../../models');
const logger = require('../../../shared/utils/logger');

/**
 * Handle pronouns modal submission
 * @param {Object} interaction - Discord modal interaction
 * @param {string} originalMessageId - Optional original profile message ID for dual updates
 */
async function handlePronounsModal(interaction, originalMessageId = null) {
    const pronounsInput = interaction.fields.getTextInputValue('pronouns_input').trim();

    // Pronouns can be empty (to remove them), but if provided should be reasonable length
        if (pronounsInput && (pronounsInput.length < 2 || pronounsInput.length > 50)) {
            logger.warn(`[PronounsModal] Validation error: pronouns length ${pronounsInput.length} for user ${interaction.user.id}`);
        return await interaction.reply({
            content: `❌ **Invalid pronouns length!**\n\n` +
                    `Pronouns should be between 2-50 characters.\n` +
                    `You entered: ${pronounsInput.length} characters\n\n` +
                    `Examples of good formats:\n` +
                    `• she/her\n` +
                    `• he/him  \n` +
                    `• they/them\n` +
                    `• any pronouns\n` +
                    `• xe/xir\n` +
                    `• he/they\n\n` +
                    `Try again with a shorter format!`,
            flags: MessageFlags.Ephemeral
        });
    }

    // Basic content validation - no excessive special characters or weird formatting
    if (pronounsInput && !/^[a-zA-Z\/\s\-]+$/.test(pronounsInput)) {
        return await interaction.reply({
            content: `❌ **Invalid characters in pronouns!**\n\n` +
                    `Please use only letters, spaces, slashes (/) and hyphens (-).\n\n` +
                    `Examples of good formats:\n` +
                    `• she/her\n` +
                    `• they/them\n` +
                    `• any pronouns\n` +
                    `• xe/xir\n` +
                    `• he/they\n\n` +
                    `Try again with standard characters!`,
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        // Update or create user record
        const updateData = {
            pronouns: pronounsInput || null // Store null if empty (removes pronouns)
        };

        await User.upsert({
            discordId: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator || '0',
            avatar: interaction.user.avatar,
            ...updateData
        });

        const responseMessage = pronounsInput ?
            `✨ **Pronouns set successfully!**\n\n` +
            `Your pronouns have been set to: **${pronounsInput}**\n\n` +
            `✅ They will appear on your profile\n` +
            `✅ Others can see them at a glance\n` +
            `✅ You can change them anytime` :
            `✨ **Pronouns removed successfully!**\n\n` +
            `Your pronouns have been cleared from your profile.\n\n` +
            `✅ They will no longer appear on your profile\n` +
            `✅ You can add them back anytime through Profile Settings`;

        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(originalMessageId ? `profile_settings_${interaction.user.id}_${originalMessageId}` : `profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        // Update the profile settings message with success and back button
        await interaction.update({
            content: responseMessage,
            components: [backButton],
            embeds: []
        });

        // If we have message tracking, try to update the original profile
        if (originalMessageId) {
            const { updateOriginalProfile } = require('../../../utils/updateOriginalProfile');
            await updateOriginalProfile(interaction, originalMessageId, 'pronouns change');
        }

        logger.info(`User ${interaction.user.tag} ${pronounsInput ? `set pronouns to "${pronounsInput}"` : 'removed pronouns'}${originalMessageId ? ' (with profile update)' : ''}`);
    } catch (error) {
        logger.error(`Error setting pronouns for ${interaction.user.tag}:`, error);
        await interaction.reply({
            content: 'Something went wrong saving your pronouns. Want to try that again?',
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = { handlePronounsModal };