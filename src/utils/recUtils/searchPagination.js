const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Builds a row of pagination buttons for search results.
 * @param {number} page - Current page (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {string} customIdBase - Unique base for custom IDs (e.g., 'recsearch')
 * @returns {ActionRowBuilder}
 */
function buildSearchPaginationRow(page, totalPages, customIdBase = 'recsearch') {
    // customIdBase should be 'recsearch' for search, but may include query info
    // Accepts: buildSearchPaginationRow(page, totalPages, 'recsearch', query)
    let query = '';
    // If customIdBase contains a colon, treat as recsearch:query
    if (customIdBase.includes(':')) {
        const parts = customIdBase.split(':');
        query = parts.slice(1).join(':');
        customIdBase = parts[0];
    }
    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:first:${query}:${page}:${totalPages}`)
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:prev:${query}:${page}:${totalPages}`)
            .setLabel('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:next:${query}:${page}:${totalPages}`)
            .setLabel('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:last:${query}:${page}:${totalPages}`)
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages)
    );
    return row;
}

module.exports = { buildSearchPaginationRow };
