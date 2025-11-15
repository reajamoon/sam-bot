const { MessageFlags } = require('discord.js');
const { User } = require('../../../../models');
const logger = require('../../../shared/utils/logger');

/**
 * Handle bio modal submission
 * @param {Object} interaction - Discord modal interaction
 * @param {string} originalMessageId - Optional original profile message ID for dual updates
 */
async function handleBioModal(interaction, originalMessageId = null) {
    const bioInput = interaction.fields.getTextInputValue('bio_input').trim();

    // Basic validation with error logging
    if (bioInput.length < 2) {
        logger.warn(`[BioModal] Validation error: bio too short (length=${bioInput.length}) for user ${interaction.user.id}`);
        return await interaction.reply({
            content: 'Bio must be at least 2 characters long. Please enter a meaningful bio.',
            flags: MessageFlags.Ephemeral
        });
    }
    if (bioInput.length > 1000) {
        logger.warn(`[BioModal] Validation error: bio too long (length=${bioInput.length}) for user ${interaction.user.id}`);
        return await interaction.reply({
            content: 'Bio should be under 1000 characters. Keep it concise, but informative.',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        // Update user's bio in database
        await User.update(
            { bio: bioInput },
            { where: { discordId: interaction.user.id } }
        );

        const responseMessage = `📝 **Bio updated successfully!**\n\n` +
                              `Your bio has been saved and will appear on your profile.\n\n` +
                              `✅ Others can see your bio when viewing your profile\n` +
                              `✅ You can update it anytime through Profile Settings`;

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
            try {
                // Try to update the original profile message in the background
                const channel = interaction.channel;
                const originalMessage = await channel.messages.fetch(originalMessageId);
                
                if (originalMessage) {
                    // Extract the profile owner from the original message embed fields
                    const originalEmbed = originalMessage.embeds[0];
                    if (originalEmbed && originalEmbed.fields) {
                        const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                        if (userIdField && userIdField.value === interaction.user.id) {
                            // Fetch fresh user data and regenerate profile
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
                            
                            // Import profile utilities
                            const { generateProfileCard, createProfileButtons } = require('../../../utils/profileCard');
                            
                            // Generate fresh profile with updated bio
                            const { embed } = await generateProfileCard(profileOwnerUser, user, interaction.client, interaction);
                            const profileButtons = createProfileButtons(interaction.user.id, interaction.user.id, originalMessageId);
                            
                            // Update the original profile message
                            await originalMessage.edit({
                                embeds: [embed],
                                components: profileButtons
                            });
                            
                            logger.info(`Successfully updated profile message ${originalMessageId} after bio change`, { service: 'discord-bot' });
                        }
                    }
                }
            } catch (profileUpdateError) {
                logger.warn(`Could not update original profile message ${originalMessageId} after bio change:`, profileUpdateError);
            }
        }

        logger.info(`User ${interaction.user.tag} updated their bio${originalMessageId ? ' (with profile update)' : ''}`);
    } catch (error) {
        logger.error(`Error setting bio for ${interaction.user.tag}:`, error);
        await interaction.reply({
            content: 'Something went wrong saving your bio. Want to try that again?',
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = { handleBioModal };