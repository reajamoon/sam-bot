import { MessageFlags } from 'discord.js';
import { Recommendation, sequelize } from '../../../../models.js';
import { Op, literal } from 'sequelize';
import createSearchResultsEmbed from '../../../../shared/recUtils/createSearchResultsEmbed.js';
import createRecommendationEmbed from '../../../../shared/recUtils/createRecommendationEmbed.js';
import { buildSearchPaginationRow } from '../../../../shared/recUtils/searchPagination.js';

export default async function handleSearchRecommendations(interaction) {
    // DEBUG: Log a sample of tags from the database
    try {
        const sampleRecs = await Recommendation.findAll({ limit: 5 });
        console.log('Sample tags from first 5 recs:');
        for (const rec of sampleRecs) {
            console.log(`ID ${rec.id}:`, rec.tags);
        }
    } catch (e) {
        console.error('Error fetching sample recs for debug:', e);
    }
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
    // Models and helpers are imported at top
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
        // Use partial, case-insensitive match for tags using jsonb_array_elements_text(tags) ILIKE
        // Example: 'canon divergence+bottom dean winchester, angst' means (canon divergence AND bottom dean winchester) OR (angst)
        // literal is imported at top
        const orGroups = tagsQuery.split(',').map(group => group.trim()).filter(Boolean);
        const tagOrClauses = [];
        for (const group of orGroups) {
            if (group.includes('+')) {
                // AND group: all tags must be present (all must match)
                const andTags = group.split('+').map(t => t.trim()).filter(Boolean);
                if (andTags.length > 0) {
                    // All tags in this group must be present (AND)
                    tagOrClauses.push({
                        [Op.and]: andTags.map(tag =>
                            literal(`EXISTS (SELECT 1 FROM jsonb_array_elements_text("tags") AS t WHERE t ILIKE '%${tag.replace(/'/g, "''")}%')`)
                        )
                    });
                }
            } else if (group.length) {
                // Single tag (OR): match if any tag matches
                const tag = group;
                tagOrClauses.push(
                    literal(`EXISTS (SELECT 1 FROM jsonb_array_elements_text("tags") AS t WHERE t ILIKE '%${tag.replace(/'/g, "''")}%')`)
                );
            }
        }
        if (tagOrClauses.length === 1) {
            whereClauses.push(tagOrClauses[0]);
        } else if (tagOrClauses.length > 1) {
            whereClauses.push({ [Op.or]: tagOrClauses });
        }
    }
    if (ratingQuery) {
        whereClauses.push({ rating: { [Op.iLike]: `%${ratingQuery.trim()}%` } });
    }
    if (summaryQuery) {
        whereClauses.push({ summary: { [Op.iLike]: `%${summaryQuery.trim()}%` } });
    }
    const where = whereClauses.length > 0 ? { [Op.and]: whereClauses } : {};

    // DEBUG: Log the where clause and generated SQL
    try {
        const q = Recommendation.findAll({ where, order: [['updatedAt', 'DESC']], limit: 1 });
        // Log the SQL generated by Sequelize
        if (q.toString) {
            console.log('Generated SQL:', q.toString());
        } else if (q._toSQL) {
            console.log('Generated SQL:', q._toSQL());
        } else {
            console.log('Where clause:', JSON.stringify(where, null, 2));
        }
    } catch (e) {
        console.error('Error logging SQL for debug:', e);
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
    if (allResults.length === 1) {
        // Show full rec embed for exact match
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
    const row = buildSearchPaginationRow(page, totalPages, `recsearch:${titleQuery || ''}`);
    const totalResults = allResults.length;
    await interaction.editReply({
        content: `Found **${totalResults}** fic${totalResults === 1 ? '' : 's'} matching your search.`,
        embeds: [embed],
        components: totalPages > 1 ? [row] : []
    });

export default handleSearchRecommendations;
