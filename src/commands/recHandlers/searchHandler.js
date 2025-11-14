const { MessageFlags } = require('discord.js');

// Search isn’t done yet. Just let folks know.
async function handleSearchRecommendations(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    const titleQuery = interaction.options.getString('title');
    if (!titleQuery || !titleQuery.trim()) {
        await interaction.editReply({
            content: 'You need to provide a title to search for, or try `/rec random` for a surprise!'
        });
        return;
    }
    const { Recommendation } = require('../../models');
    const { Op } = require('sequelize');
    const createSearchResultsEmbed = require('../../utils/recUtils/createSearchResultsEmbed');
    // Case-insensitive, partial match, up to 25 results
    const allResults = await Recommendation.findAll({
        where: {
            title: { [Op.iLike]: `%${titleQuery.trim()}%` }
        },
        order: [['updatedAt', 'DESC']],
        limit: 25
    });
    if (!allResults.length) {
        await interaction.editReply({
            content: `Sorry, I couldn't find any recommendations with a title matching "${titleQuery}". Try a different title or check your spelling!`
        });
        return;
    }
    // Pagination: 5 results per page
    const page = 1;
    const perPage = 5;
    const totalPages = Math.ceil(allResults.length / perPage);
    const recs = allResults.slice((page - 1) * perPage, page * perPage);
    const embed = createSearchResultsEmbed(recs, page, totalPages, titleQuery);
    const { buildSearchPaginationRow } = require('../../utils/recUtils/searchPagination');
    const row = buildSearchPaginationRow(page, totalPages, 'recsearch');
    // Store search state in a customId for future interaction handling (not yet implemented)
    await interaction.editReply({
        content: `Here are your search results for "${titleQuery}":`,
        embeds: [embed],
        components: totalPages > 1 ? [row] : []
    });
}

module.exports = handleSearchRecommendations;
