const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { encodeMessageId } = require('./messageTracking');
const { buildButtonId } = require('./buttonId');

/**
 * Shared navigation button logic for profile help menus
 * @param {EmbedBuilder} embed - The embed to add buttons to
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Object with embed and component rows
 */
function createHelpWithBackButton(embed, interaction) {
    const userId = interaction?.user?.id || interaction?.member?.user?.id || '';
    const messageId = interaction?.message?.id || interaction?.id || '';
    let encodedMsgId = messageId ? encodeMessageId(messageId) : '';
    if (!encodedMsgId) encodedMsgId = 'ephemeral';

    // Navigation buttons for all help categories
    const categories = [
        { action: 'birthday', label: 'Birthday', emoji: '🎂' },
        { action: 'bio', label: 'Bio', emoji: '📝' },
        { action: 'privacy', label: 'Privacy', emoji: '🔒' },
        { action: 'timezone_region', label: 'Timezone/Region', emoji: '🌍' },
        { action: 'tips', label: 'Tips', emoji: '💡' }
    ];
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    categories.slice(0, 3).forEach(cat => {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId({ action: cat.action, context: 'profile_help_menu', primaryId: userId, secondaryId: encodedMsgId }))
                .setLabel(cat.label)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(cat.emoji)
        );
    });
    categories.slice(3, 6).forEach(cat => {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(buildButtonId({ action: cat.action, context: 'profile_help_menu', primaryId: userId, secondaryId: encodedMsgId }))
                .setLabel(cat.label)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(cat.emoji)
        );
    });

    // Only show back button if not on main help menu
    const isMainMenu = embed?.data?.title === '📚 Profile Help';
    const closeCustomId = buildButtonId({ action: 'done', context: 'profile_help_menu', primaryId: userId, secondaryId: encodedMsgId });
    let navRow;
    if (isMainMenu) {
        navRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(closeCustomId)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✖️')
            );
    } else {
        const backCustomId = buildButtonId({ action: 'main', context: 'profile_help_menu', primaryId: userId, secondaryId: encodedMsgId });
        navRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(backCustomId)
                    .setLabel('Back to Help Menu')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⬅️'),
                new ButtonBuilder()
                    .setCustomId(closeCustomId)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✖️')
            );
    }
    return { embed, components: [row1, row2, navRow] };
}

module.exports = {
    createHelpWithBackButton
};
