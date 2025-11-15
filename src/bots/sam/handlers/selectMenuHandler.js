const { User } = require('../../../models');
const logger = require('../utils/logger');

/**
 * Handle select menu interactions
 */
async function handleSelectMenu(interaction) {
    try {
        if (interaction.customId.startsWith('timezone_display_select')) {
            const selectedOption = interaction.values[0];
            try {
                await User.update(
                    { timezoneDisplay: selectedOption },
                    { where: { discordId: interaction.user.id } }
                );

                const optionNames = {
                    'iana': 'Full Name (e.g., America/New_York)',
                    'offset': 'UTC Offset (e.g., UTC-5)',
                    'short': 'Short Code (e.g., EST, PST)',
                    'combined': 'Combined (e.g., (UTC-08:00) Pacific Time)',
                    'hidden': 'Hidden (timezone won\'t show on profile)'
                };

                // Extract message ID from the select menu custom ID first
                let messageIdForButton = null;
                if (interaction.customId.includes('_')) {
                    const parts = interaction.customId.split('_');
                    if (parts.length >= 4) {
                        messageIdForButton = parts[3];
                    }
                }

                // Create back button to return to Profile Settings with proper message tracking
                const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(messageIdForButton ? `profile_settings_${interaction.user.id}_${messageIdForButton}` : `profile_settings_${interaction.user.id}`)
                            .setLabel('← Back to Profile Settings')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⚙️')
                    );

                await interaction.update({
                    content: `🌍 **Timezone display updated!**\n\n` +
                           `Your timezone will now show as: **${optionNames[selectedOption]}**\n\n` +
                           `✅ Changes will appear in your profile automatically\n` +
                           `✅ Others will see your timezone in the new format\n` +
                           `✅ You can change this anytime in Profile Settings`,
                    components: [backButton]
                });

                // Try to update the original profile message if we can extract the message ID
                // Extract message ID from the select menu custom ID: timezone_display_select_messageId
                let originalMessageId = null;
                if (interaction.customId.includes('_')) {
                    const parts = interaction.customId.split('_');
                    if (parts.length >= 4) {
                        originalMessageId = parts[3];
                    }
                }

                // Update the original profile if we found the message ID
                if (originalMessageId) {
                    const { updateOriginalProfile } = require('../utils/updateOriginalProfile');
                    await updateOriginalProfile(interaction, originalMessageId, 'timezone display change');
                }

                logger.info(`User ${interaction.user.tag} updated timezone display to ${selectedOption}`);
            } catch (error) {
                logger.error(`Error updating timezone display for ${interaction.user.tag}:`, error);
                await interaction.update({
                    content: 'Something went wrong updating your timezone display. Want to try that again?',
                    components: []
                });
            }
        }
        // Test button for development
        else if (interaction.customId === 'test_button_update') {
            try {
                await interaction.update({
                    content: '✅ **Button update test successful!**\n\nButtons can successfully update their own messages.',
                    components: []
                });
            } catch (error) {
                console.error('Error in test button:', error);
            }
        }
        else {
            logger.warn(`Unhandled select menu interaction: ${interaction.customId}`);
            const { InteractionFlags } = require('discord.js');
            const EPHEMERAL_FLAG = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
            await interaction.reply({
                content: 'This select menu interaction is not currently supported.',
                flags: EPHEMERAL_FLAG
            });
        }
        
    } catch (error) {
        logger.error('Error in select menu handler:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                const { InteractionFlags } = require('discord.js');
                await interaction.reply({
                    content: 'Something went wrong processing that selection. Please try again.',
                    flags: InteractionFlags.Ephemeral
                });
            }
        } catch (responseError) {
            logger.error('Error responding to failed select menu interaction:', responseError);
        }
    }
}

module.exports = { handleSelectMenu };