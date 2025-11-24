// Handler for toggling age-hidden privacy mode
import { User } from '../../../../../models/index.js';
import { getProfileMessageId, parsePrivacySettingsCustomId } from '../../../../../shared/utils/messageTracking.js';
import { buildPrivacySettingsMenu } from './privacyMenu.js';
import { performDualUpdate } from '../../../../../shared/utils/dualUpdate.js';
import logger from '../../../../../shared/utils/logger.js';
import { InteractionFlags, EmbedBuilder } from 'discord.js';

export default async function handleTogglePrivacyModeAgeHidden(interaction) {
    // Ephemeral message flag pattern: use InteractionFlags.Ephemeral if available, otherwise fallback to 64.
    // This ensures compatibility across discord.js versions and prevents undefined errors.
    const ephemeralFlag = typeof InteractionFlags !== 'undefined' && InteractionFlags.Ephemeral ? InteractionFlags.Ephemeral : 64;
    try {
        // Extract the original profile card message ID from the customId only
        let originalMessageId = null;
        const parsed = parsePrivacySettingsCustomId(interaction.customId);
        if (parsed && parsed.messageId && /^\d{17,19}$/.test(parsed.messageId)) {
            originalMessageId = parsed.messageId;
        }
        let bypassDualUpdate = false;
        if (originalMessageId) {
            try {
                const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed || !originalEmbed.fields) {
                    originalMessageId = null;
                } else {
                    const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                    if (!userIdField || userIdField.value !== interaction.user.id) {
                        originalMessageId = null;
                    }
                }
            } catch (fetchError) {
                originalMessageId = null;
            }
        } else {
            bypassDualUpdate = true;
        }

        const [user] = await User.findOrCreate({
            where: { discordId: interaction.user.id },
            defaults: {
                discordId: interaction.user.id,
                username: interaction.user.username,
                discriminator: interaction.user.discriminator || '0',
                avatar: interaction.user.avatar
            }
        });

        const currentValue = user.birthdayAgeOnly === true;
        const isPrivacyModeStrict = user.birthdayYearHidden === true;
        if (isPrivacyModeStrict) {
            await interaction.reply({
                content: `**Privacy Mode (Age Hidden) is Locked in Privacy Mode (Strict)**\n\n` +
                       `🔒 Privacy Mode (Age Hidden) is locked ON because you set your birthday without birth year (Privacy Mode Strict).\n\n` +
                       `**To make Privacy Mode (Age Hidden) toggleable:**\n` +
                       `• Update your birthday to include birth year (like 12/25/2001)\n` +
                       `• This will exit Privacy Mode (Strict) and make the toggle available\n\n` +
                       `**To stay in Privacy Mode (Strict):**\n` +
                       `• Keep your current setting - age stays hidden, birthday/zodiac visible\n` +
                       `• You can still change mentions and daily list settings\n\n` +
                       'Use the Birthday Settings button on your profile to change other settings.',
                flags: ephemeralFlag
            });
            return;
        }

        const newValue = !currentValue;
        await User.update(
            { birthdayAgeOnly: newValue },
            { where: { discordId: interaction.user.id } }
        );

        if (bypassDualUpdate) {
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFAA61A)
                .setDescription('⚠️ Your privacy mode was updated, but it won\'t show on your profile until a new profile is generated.');
            await interaction.reply({ embeds: [warningEmbed], flags: ephemeralFlag });
            return;
        }

        // Get updated user data and build refreshed menu
        const updatedUser = await User.findOne({ where: { discordId: interaction.user.id } });
        const { components, embeds } = buildPrivacySettingsMenu(updatedUser, interaction.user.id, originalMessageId, originalMessageId, interaction);

        // Use shared dual update system
        await performDualUpdate(
            interaction,
            { components, embeds, flags: ephemeralFlag },
            originalMessageId,
            'toggle privacy mode age hidden'
        );
    } catch (error) {
        logger.error(`Error toggling Privacy Mode (Age Hidden) for ${interaction.user.tag}:`, error);
        const errorMsg = 'Something went wrong updating your Privacy Mode (Age Hidden) setting. Want to try that again?';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMsg, flags: ephemeralFlag });
        } else {
            await interaction.reply({ content: errorMsg, flags: ephemeralFlag });
        }
    }
}