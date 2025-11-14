const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Builds a row of pagination buttons for search results.
 * @param {number} page - Current page (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {string} customIdBase - Unique base for custom IDs (e.g., 'recsearch')
 * @returns {ActionRowBuilder}
 */
function buildSearchPaginationRow(page, totalPages, customIdBase = 'recsearch') {
    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${customIdBase}_first`)
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}_prev`)
            .setLabel('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}_next`)
            .setLabel('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}_last`)
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages)
    );
    return row;
}

module.exports = { buildSearchPaginationRow };
