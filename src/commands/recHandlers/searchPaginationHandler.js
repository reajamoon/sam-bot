const { Recommendation } = require('../../models');
const { Op } = require('sequelize');
const createSearchResultsEmbed = require('../../shared/recUtils/createSearchResultsEmbed');
const { buildSearchPaginationRow } = require('../../shared/recUtils/searchPagination');

/**
 * Handles button interactions for search pagination.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<void>}
 */
async function handleSearchPagination(interaction) {
    // Example customId: recsearch_next:query:page:totalPages
    const [base, action, rawQuery, rawPage, rawTotal] = interaction.customId.split(':');
    const query = rawQuery ? decodeURIComponent(rawQuery) : '';
    const totalPages = parseInt(rawTotal, 10) || 1;
    let page = parseInt(rawPage, 10) || 1;
    if (action === 'next') page++;
    if (action === 'prev') page--;
    if (action === 'first') page = 1;
    if (action === 'last') page = totalPages;
    // Clamp page
    page = Math.max(1, Math.min(page, totalPages));
    // Fetch all results for the query (up to 25)
    const allResultsRaw = await Recommendation.findAll({
        where: {
            title: { [Op.iLike]: `%${query.trim()}%` }
        },
        order: [['updatedAt', 'DESC']],
        limit: 25
    });
    // Deduplicate by URL (or title if URL missing)
    const seen = new Set();
    const allResults = allResultsRaw.filter(rec => {
        const key = rec.url || rec.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const perPage = 3;
    const recs = allResults.slice((page - 1) * perPage, page * perPage);
    const embed = createSearchResultsEmbed(recs, page, totalPages, query);
    const row = buildSearchPaginationRow(page, totalPages, `recsearch:${query}`);
    await interaction.update({
        embeds: [embed],
        components: totalPages > 1 ? [row] : [],
        content: `Here are your search results for "${query}":`
    });
}

module.exports = handleSearchPagination;
