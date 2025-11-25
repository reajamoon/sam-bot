
import { User } from '../../../../../models';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { buildButtonId } from '../../../../../shared/utils/buttonId.js';
import { performDualUpdate } from '../../../../../shared/utils/dualUpdate.js';
import { updateOriginalProfile } from '../../../utils/updateOriginalProfile.js';
import { getProfileMessageId, buildProfileButtonId } from '../../../../../shared/utils/messageTracking.js';
import logger from '../../../../../shared/utils/logger.js';

async function handleRegionDisplay(interaction) {
    const targetUserId = interaction.user.id;
    // extract original profile card message ID
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Debug logging for message ID propagation
    logger.info('[RegionDisplay] customId:', { customId: interaction.customId });
    logger.info('[RegionDisplay] originalMessageId:', { originalMessageId });

    const user = await User.findByPk(interaction.user.id);
    if (!user) {
        return await interaction.reply({
            content: '❌ **User not found in database.**',
            flags: 64
        });
    }

    // Toggle region display setting
    const newRegionDisplay = !user.regionDisplay;
    await user.update({ regionDisplay: newRegionDisplay });

    // Confirmation message
    const statusText = newRegionDisplay ? 'shown' : 'hidden';
    const description = newRegionDisplay 
        ? '✅ **Region will now be shown in your profile.**\n\n' +
          (user.timezoneHidden ? 
            'Since your timezone is hidden, region will appear as a separate field.' :
            'Region will appear under your timezone field.')
        : '❌ **Region is now hidden from your profile.**';

    const confirmEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🔧 Profile Settings - Region Display')
        .setDescription(description)
        .setFooter({ 
            text: `Region Display: ${statusText}`,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

    // button custom ID
    const backButtonCustomId = buildProfileButtonId('back_to_profile_settings', 'profile_settings', interaction.user.id, originalMessageId);
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(backButtonCustomId)
                .setLabel('← Back to Profile Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
        );

    const ephemeralResponse = {
        embeds: [confirmEmbed],
        components: [backButton]
    };

    await performDualUpdate(
        interaction,
        ephemeralResponse,
        originalMessageId,
        'region display toggle'
    );
}

export { handleRegionDisplay };
