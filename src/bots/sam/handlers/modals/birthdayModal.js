const { MessageFlags } = require('discord.js');
const { User } = require('../../../../models');
const logger = require('../../../shared/utils/logger');

/**
 * Handle birthday modal submission
 * @param {Object} interaction - Discord modal interaction
 * @param {string} originalMessageId - Optional original profile message ID for dual updates
 */
async function handleBirthdayModal(interaction, originalMessageId = null) {
    const birthdayInput = interaction.fields.getTextInputValue('birthday_input').trim();

    // Parse and validate various date formats
    let birthdayToStore;
    let isPrivacyMode = false;
    let parsedDate = null;

    // Define regex patterns for different formats
    const formats = {
        // Full date formats with year
        fullSlash: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or M/D/YYYY
        fullDash: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD or YYYY-M-D
        // Privacy formats without year
        privacySlash: /^(\d{1,2})\/(\d{1,2})$/, // MM/DD or M/D
        // Two-digit year formats
        twoDigitSlash: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/ // MM/DD/YY or M/D/YY
    };

    // Try to parse different formats
    if (formats.fullSlash.test(birthdayInput)) {
        const [, month, day, year] = birthdayInput.match(formats.fullSlash);
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        birthdayToStore = `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    } else if (formats.fullDash.test(birthdayInput)) {
        const [, year, month, day] = birthdayInput.match(formats.fullDash);
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        birthdayToStore = `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    } else if (formats.privacySlash.test(birthdayInput)) {
        const [, month, day] = birthdayInput.match(formats.privacySlash);
        // For privacy mode, we store without year and set privacy flags
        birthdayToStore = `${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
        isPrivacyMode = true;
        // Create a date for validation (using current year)
        parsedDate = new Date(new Date().getFullYear(), parseInt(month) - 1, parseInt(day));
    } else if (formats.twoDigitSlash.test(birthdayInput)) {
        const [, month, day, shortYear] = birthdayInput.match(formats.twoDigitSlash);
        // Convert 2-digit year to 4-digit (assume 1900s for 50-99, 2000s for 00-49)
        const fullYear = parseInt(shortYear) >= 50 ? 1900 + parseInt(shortYear) : 2000 + parseInt(shortYear);
        parsedDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        birthdayToStore = `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${fullYear}`;
    } else {
        return await interaction.reply({
            content: '❌ **Invalid date format!**\n\nPlease use one of these formats:\n' +
                    '• **MM/DD/YYYY** (e.g., 12/25/1995) - Full birthday with year\n' +
                    '• **MM/DD** (e.g., 12/25) - Privacy mode (no year shown)\n' +
                    '• **YYYY-MM-DD** (e.g., 1995-12-25) - ISO format\n' +
                    '\nTry again with a valid format!',
            flags: MessageFlags.Ephemeral
        });
    }

    // Validate the parsed date
    if (!parsedDate || isNaN(parsedDate.getTime())) {
        return await interaction.reply({
            content: '❌ **Invalid date!** Please enter a real date (like 12/25 or 02/29/2000).',
            flags: MessageFlags.Ephemeral
        });
    }

    // Check for reasonable date ranges
    const currentYear = new Date().getFullYear();
    const birthYear = parsedDate.getFullYear();

    if (!isPrivacyMode && (birthYear < 1900 || birthYear > currentYear)) {
        return await interaction.reply({
            content: `❌ **Invalid birth year!** Please enter a year between 1900 and ${currentYear}.`,
            flags: MessageFlags.Ephemeral
        });
    }

    // Check for valid month and day
    const month = parsedDate.getMonth() + 1;
    const day = parsedDate.getDate();

    if (month < 1 || month > 12) {
        return await interaction.reply({
            content: '❌ **Invalid month!** Month must be between 1 and 12.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (day < 1 || day > 31) {
        return await interaction.reply({
            content: '❌ **Invalid day!** Day must be between 1 and 31.',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        // Update or create user record
        const updateData = {
            birthday: birthdayToStore,
            birthdayYearHidden: isPrivacyMode,
            birthdayAgePrivacy: isPrivacyMode, // Auto-enable age privacy in privacy mode
        };

        await User.upsert({
            discordId: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator || '0',
            avatar: interaction.user.avatar,
            ...updateData
        });

        const responseMessage = isPrivacyMode ?
            `🎂 **Birthday set in privacy mode!**\n\n` +
            `Your birthday (${birthdayToStore}) has been saved. Since you didn't include a birth year:\n\n` +
            `✅ Age privacy is **ON** (your age won't be shown)\n` +
            `✅ Only your zodiac sign will appear in your profile\n` +
            `✅ You'll still get birthday mentions and appear in daily lists\n\n` +
            `Want to include your birth year later? Just set your birthday again with the full date!` :
            `🎂 **Birthday set successfully!**\n\n` +
            `Your birthday (${birthdayToStore}) has been saved!\n\n` +
            `✅ Your age and zodiac signs will appear in your profile\n` +
            `✅ You'll get birthday mentions and appear in daily lists\n` +
            `✅ You can adjust privacy settings anytime`;

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

                            // Generate fresh profile with updated birthday
                            const { embed } = await generateProfileCard(profileOwnerUser, user, interaction.client, interaction);
                            const profileButtons = createProfileButtons(interaction.user.id, interaction.user.id, originalMessageId);

                            // Update the original profile message
                            await originalMessage.edit({
                                embeds: [embed],
                                components: profileButtons
                            });

                            logger.info(`Successfully updated profile message ${originalMessageId} after birthday change`, { service: 'discord-bot' });
                        }
                    }
                }
            } catch (profileUpdateError) {
                logger.warn(`Could not update original profile message ${originalMessageId} after birthday change:`, profileUpdateError);
            }
        }

        logger.info(`User ${interaction.user.tag} set birthday to ${birthdayToStore} (privacy mode: ${isPrivacyMode})${originalMessageId ? ' (with profile update)' : ''}`);
    } catch (error) {
        logger.error(`Error setting birthday for ${interaction.user.tag}:`, error);
        await interaction.reply({
            content: 'Something went wrong saving your birthday. Want to try that again?',
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = { handleBirthdayModal };