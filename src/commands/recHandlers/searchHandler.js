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
    const idQuery = interaction.options.getString('id');
    const workIdQuery = interaction.options.getString('workid');
    const urlQuery = interaction.options.getString('url');
    const titleQuery = interaction.options.getString('title');
    const authorQuery = interaction.options.getString('author');
    const tagsQuery = interaction.options.getString('tags');
    const ratingQuery = interaction.options.getString('rating');
    const summaryQuery = interaction.options.getString('summary');
    if (!idQuery && !workIdQuery && !urlQuery && !titleQuery && !authorQuery && !tagsQuery && !ratingQuery && !summaryQuery) {
        await interaction.editReply({
            content: 'You need to provide at least one search field (ID, work ID, URL, title, author, tags, rating, or summary), or try `/rec random` for a surprise!'
        });
        return;
    }
    const { Recommendation } = require('../../models');
    const { Op } = require('sequelize');
    const createSearchResultsEmbed = require('../../utils/recUtils/createSearchResultsEmbed');
    // Build AND filter for all provided fields using [Op.and]
    const whereClauses = [];
    if (idQuery) {
        const idNum = parseInt(idQuery, 10);
        if (!isNaN(idNum)) {
            whereClauses.push({ id: idNum });
        } else {
            await interaction.editReply({ content: 'Fic ID must be a number.' });
            return;
        }
    }
    if (workIdQuery) {
        whereClauses.push({ url: { [Op.iLike]: `%/works/${workIdQuery}` } });
    }
    if (urlQuery) {
        whereClauses.push({ url: urlQuery.trim() });
    }
    if (titleQuery) {
        whereClauses.push({ title: { [Op.iLike]: `%${titleQuery.trim()}%` } });
    }
    if (authorQuery) {
        whereClauses.push({
            [Op.or]: [
                { author: { [Op.iLike]: `%${authorQuery.trim()}%` } },
                { authors: { [Op.contains]: [authorQuery.trim()] } }
            ]
        });
    }
    if (tagsQuery) {
        // Advanced: allow mixing AND (+) and OR (,) logic
        // Example: 'canon divergence+bottom dean winchester, angst' means (canon divergence AND bottom dean winchester) OR (angst)
        const orGroups = tagsQuery.split(',').map(group => group.trim()).filter(Boolean);
        const tagOrClauses = [];
        for (const group of orGroups) {
            if (group.includes('+')) {
                // AND group
                const andTags = group.split('+').map(t => t.trim()).filter(Boolean);
                if (Array.isArray(andTags) && andTags.length > 0) {
                    tagOrClauses.push({ tags: { [Op.contains]: andTags } });
                }
            } else if (group.length) {
                // Single tag (OR)
                // Ensure group is not an accidental array or empty string
                if (typeof group === 'string' && group.trim().length > 0) {
                    tagOrClauses.push({ tags: { [Op.overlap]: [group.trim()] } });
                }
            }
        }
        // Only push valid clauses
        const validTagOrClauses = tagOrClauses.filter(clause => {
            if (clause.tags[Op.contains]) {
                return Array.isArray(clause.tags[Op.contains]) && clause.tags[Op.contains].length > 0;
            }
            if (clause.tags[Op.overlap]) {
                return Array.isArray(clause.tags[Op.overlap]) && clause.tags[Op.overlap].length > 0;
            }
            return false;
        });
        if (validTagOrClauses.length === 1) {
            whereClauses.push(validTagOrClauses[0]);
        } else if (validTagOrClauses.length > 1) {
            whereClauses.push({ [Op.or]: validTagOrClauses });
        }
    }
    if (ratingQuery) {
        whereClauses.push({ rating: { [Op.iLike]: `%${ratingQuery.trim()}%` } });
    }
    if (summaryQuery) {
        whereClauses.push({ summary: { [Op.iLike]: `%${summaryQuery.trim()}%` } });
    }
    const where = whereClauses.length > 0 ? { [Op.and]: whereClauses } : {};
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
    if (allResults.length === 1) {
        // Show full rec embed for exact match
        const createRecommendationEmbed = require('../../utils/recUtils/createRecommendationEmbed');
        const embed = await createRecommendationEmbed(allResults[0]);
        await interaction.editReply({
            content: `Found 1 fic matching your search.`,
            embeds: [embed],
            components: []
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
