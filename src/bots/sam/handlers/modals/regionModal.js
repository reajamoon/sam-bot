const { MessageFlags } = require('discord.js');
const { User } = require('../../../../shared/models');
const logger = require('../../../shared/utils/logger');
const { validateRegion } = require('../../../shared/utils/regionValidator');

/**
 * Handle region modal submission
 * @param {Object} interaction - Discord modal interaction
 * @param {string} originalMessageId - Optional original profile message ID for dual updates
 */
async function handleRegionModal(interaction, originalMessageId = null) {
    logger.info(`=== REGION MODAL START === User: ${interaction.user.tag}, CustomId: ${interaction.customId}`);
    logger.info(`Region Modal: originalMessageId parameter = ${originalMessageId}`);

    // Log all field customIds for debugging
    const allFieldIds = interaction.fields.fields.map(f => f.customId);
    logger.info(`Region Modal: received field customIds: ${JSON.stringify(allFieldIds)}`);

    const regionInput = interaction.fields.getTextInputValue('region_input').trim();
    logger.info(`Region Modal: regionInput = "${regionInput}"`);
    
    if (!regionInput) {
        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        return await interaction.update({
            content: '❌ **Region cannot be empty!**\n\nPlease try again with a valid region, country, or timezone area.',
            components: [backButton],
            embeds: []
        });
    }
    if (regionInput.length < 2) {
        logger.warn(`[RegionModal] Validation error: region too short (length=${regionInput.length}) for user ${interaction.user.id}`);
        return await interaction.reply({
            content: 'Region must be at least 2 characters long. Please enter a valid region.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Validate the region input
    console.log(`Region validation for user ${interaction.user.id}: input="${regionInput}"`);
    const validation = validateRegion(regionInput);
    console.log(`Region validation result:`, validation);
    
    if (!validation.isValid) {
        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        let errorMessage = `❌ **Invalid region format!**\n\n`;

        if (validation.suggestions.length > 0) {
            // Check if these look like ambiguous region suggestions
            if (validation.suggestions.some(s => s.includes(','))) {
                errorMessage += `**Multiple regions found with that name:**\n${validation.suggestions.map(s => `• ${s}`).join('\n')}\n\n`;
                errorMessage += `Please be more specific by including the country:\n`;
                errorMessage += `• Use format: **Region, Country** (e.g., "WA, USA" or "WA, Australia")\n`;
                errorMessage += `• Or use full names: **Washington, United States**\n\n`;
            } else {
                errorMessage += `**Did you mean:**\n${validation.suggestions.map(s => `• ${s}`).join('\n')}\n\n`;
            }
        } else {
            errorMessage += `Please use one of these formats:\n` +
                          `• **Country names**: United States, Canada, Japan\n` +
                          `• **Country codes**: US, CA, JP\n` +
                          `• **Regions with country**: California, US or Ontario, Canada\n` +
                          `• **Time zones**: Pacific, Central, Eastern\n\n`;
        }

        errorMessage += `Try again with a valid region!`;

        return await interaction.update({
            content: null,
            components: [backButton],
            embeds: [
                {
                    title: 'Region Error',
                    description: errorMessage
                }
            ]
        });
    }

    try {
        // Update or create user record with normalized region
        await User.upsert({
            discordId: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator || '0',
            avatar: interaction.user.avatar,
            region: validation.normalizedRegion
        });

        const responseMessage = `🌍 **Region set successfully!**\n\n` +
                              `Your region has been set to: **${validation.normalizedRegion}**\n\n` +
                              `✅ Your profile will now show your region\n` +
                              `✅ Others can see where you're from\n` +
                              `✅ You can change this anytime in Profile Settings\n\n` +
                              `Use **Profile Settings** → **Region** to update it!`;

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

        logger.info(`Region Modal: Successfully updated interaction. About to attempt dual update with originalMessageId: ${originalMessageId}`);

        // If we have message tracking, try to update the original profile
        if (originalMessageId) {
            const { updateOriginalProfile } = require('../../../utils/updateOriginalProfile');
            await updateOriginalProfile(interaction, originalMessageId, 'region change');
        }

        logger.info(`User ${interaction.user.tag} set region to ${validation.normalizedRegion}${originalMessageId ? ' (with profile update)' : ''}`);
    } catch (error) {
        logger.error(`Error setting region for ${interaction.user.tag}:`, error);
        
        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        await interaction.update({
            content: '❌ **Something went wrong saving your region.**\n\nPlease try again!',
            components: [backButton],
            embeds: []
        });
    }
}

module.exports = { handleRegionModal };