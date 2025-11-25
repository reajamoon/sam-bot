import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { buildButtonId } from '../../../../shared/utils/buttonId.js';
import { User } from '../../../../models/index.js';

/**
 * Handler for toggling region display in the profile.
 * @param {Object} interaction - Discord interaction object
 */
export async function handleRegionDisplay(interaction) {
    const { customId, user, message } = interaction;
    const parsed = customId.includes('_') ? customId.split('_') : [];
    const targetUserId = parsed.length >= 3 ? parsed[2] : user.id;
    let originalMessageId = parsed.length >= 4 ? parsed[3] : (message?.id || null);

    try {
        const dbUser = await User.findByPk(user.id);
        if (!dbUser) {
            return await interaction.reply({
                content: '❌ **User not found in database.**',
                flags: 64
            });
        }
        // Toggle region display setting
        const newRegionDisplay = !dbUser.regionDisplay;
        await dbUser.update({ regionDisplay: newRegionDisplay });
        // Confirmation message
        const statusText = newRegionDisplay ? 'shown' : 'hidden';
        const description = newRegionDisplay
            ? '✅ **Region will now be shown in your profile.**\n\n' +
              (dbUser.timezoneHidden ?
                'Since your timezone is hidden, region will appear as a separate field.' :
                'Region will appear under your timezone field.')
            : '❌ **Region is now hidden from your profile.**';
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔧 Profile Settings - Region Display')
            .setDescription(description)
            .setFooter({
                text: `Region Display: ${statusText}`,
                iconURL: user.displayAvatarURL()
            })
            .setTimestamp();
        // Back button
        let propagatedMessageId = originalMessageId;
        if (!propagatedMessageId && message?.id) {
            propagatedMessageId = message.id;
        }
        const backButtonCustomId = await buildButtonId({
            action: 'back_to_profile_settings',
            context: 'profile_settings',
            primaryId: user.id,
            secondaryId: propagatedMessageId
        });
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(backButtonCustomId)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );
        // Ephemeral response
        const ephemeralResponse = {
            embeds: [confirmEmbed],
            components: [backButton]
        };
        if (interaction.isButton && interaction.isButton() && message && message.flags?.has('Ephemeral')) {
            await interaction.update(ephemeralResponse);
            // Optionally update the original profile message in the background if needed
        } else {
            await interaction.reply({ ...ephemeralResponse, flags: 64 });
        }
    } catch (error) {
        console.error('Error handling region display toggle:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error')
            .setDescription('An error occurred while updating your region display setting. Please try again.')
            .setTimestamp();
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(originalMessageId ? `back_to_profile_settings_${user.id}_${originalMessageId}` : 'back_to_profile_settings')
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );
        if (message && message.flags?.has('Ephemeral')) {
            await interaction.update({
                embeds: [errorEmbed],
                components: [backButton]
            });
        } else {
            await interaction.reply({
                embeds: [errorEmbed],
                components: [backButton],
                flags: 64
            });
        }
    }
}
