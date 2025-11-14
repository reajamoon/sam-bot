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
    const authorQuery = interaction.options.getString('author');
    const tagsQuery = interaction.options.getString('tags');
    const ratingQuery = interaction.options.getString('rating');
    const summaryQuery = interaction.options.getString('summary');
    if (!titleQuery && !authorQuery && !tagsQuery && !ratingQuery && !summaryQuery) {
        await interaction.editReply({
            content: 'You need to provide at least one search field (title, author, tags, rating, or summary), or try `/rec random` for a surprise!'
        });
        return;
    }
    const { Recommendation } = require('../../models');
    const { Op } = require('sequelize');
    const createSearchResultsEmbed = require('../../utils/recUtils/createSearchResultsEmbed');
    // Build AND filter for all provided fields
    const where = {};
    if (titleQuery) {
        where.title = { [Op.iLike]: `%${titleQuery.trim()}%` };
    }
    if (authorQuery) {
        // Search both author (string) and authors (array)
        where[Op.or] = [
            { author: { [Op.iLike]: `%${authorQuery.trim()}%` } },
            { authors: { [Op.contains]: [authorQuery.trim()] } }
        ];
    }
    if (tagsQuery) {
        // Split comma-separated tags, match any (OR)
        const tags = tagsQuery.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length) {
            where.tags = { [Op.overlap]: tags };
        }
    }
    if (ratingQuery) {
        where.rating = { [Op.iLike]: `%${ratingQuery.trim()}%` };
    }
    if (summaryQuery) {
        where.summary = { [Op.iLike]: `%${summaryQuery.trim()}%` };
    }
    const allResultsRaw = await Recommendation.findAll({
        where,
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
    if (!allResults.length) {
        await interaction.editReply({
            content: `Sorry, I couldn't find any recommendations matching your search. Try different keywords or check your spelling!`
        });
        return;
    }
    // Pagination: 3 results per page
    const page = 1;
    const perPage = 3;
    const totalPages = Math.ceil(allResults.length / perPage);
    const recs = allResults.slice((page - 1) * perPage, page * perPage);
    // Show a summary of the search fields in the embed
    let searchSummary = [];
    if (titleQuery) searchSummary.push(`title: "${titleQuery}"`);
    if (authorQuery) searchSummary.push(`author: "${authorQuery}"`);
    if (tagsQuery) searchSummary.push(`tags: "${tagsQuery}"`);
    if (ratingQuery) searchSummary.push(`rating: "${ratingQuery}"`);
    if (summaryQuery) searchSummary.push(`summary: "${summaryQuery}"`);
    const embed = createSearchResultsEmbed(recs, page, totalPages, searchSummary.join(', '));
    const { buildSearchPaginationRow } = require('../../utils/recUtils/searchPagination');
    const row = buildSearchPaginationRow(page, totalPages, `recsearch:${titleQuery || ''}`);
    const totalResults = allResults.length;
    await interaction.editReply({
        content: `Found **${totalResults}** fic${totalResults === 1 ? '' : 's'} matching your search.`,
        embeds: [embed],
        components: totalPages > 1 ? [row] : []
    });
}

module.exports = handleSearchRecommendations;
