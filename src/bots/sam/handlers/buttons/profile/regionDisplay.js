const { User } = require('../../../../../shared/models');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildButtonId } = require('../../../../../shared/utils/buttonId');
const { performDualUpdate } = require('../../../../utils/dualUpdate');
const { updateOriginalProfile } = require('../../../../utils/updateOriginalProfile');

async function handleRegionDisplay(interaction) {
    const { getProfileMessageId, buildProfileButtonId } = require('../../../../../shared/utils/messageTracking');
    const targetUserId = interaction.user.id;
    // extract original profile card message ID
    const originalMessageId = getProfileMessageId(interaction, interaction.customId);

    // Debug logging for message ID propagation
    const logger = require('../../../../../shared/utils/logger');
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

module.exports = { handleRegionDisplay };
