import { Recommendation, sequelize } from '../../../../models/index.js';
import { Op } from 'sequelize';
import createSearchResultsEmbed from '../../../../shared/recUtils/createSearchResultsEmbed.js';
import { buildSearchPaginationRow, getCachedQuery } from '../../../../shared/recUtils/searchPagination.js';
import { createTagSearchConditions } from '../../../../utils/tagUtils.js';

/**
 * Handles button interactions for search pagination.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<void>}
 */
async function handleSearchPagination(interaction) {
    try {
        // Parse customId: recsearch:action:queryId:page:totalPages
        const [base, action, queryId, rawPage, rawTotal] = interaction.customId.split(':');
        const totalPages = parseInt(rawTotal, 10) || 1;
        let page = parseInt(rawPage, 10) || 1;
        
        if (action === 'next') page++;
        if (action === 'prev') page--;
        if (action === 'first') page = 1;
        if (action === 'last') page = totalPages;
        
        // Clamp page
        page = Math.max(1, Math.min(page, totalPages));
        
        // Get cached query data
        const queryParams = await getCachedQuery(queryId);
        if (!queryParams) {
            await interaction.update({ 
                content: 'Error: Search session expired. Please try your search again.',
                embeds: [],
                components: []
            });
            return;
        }
    
    const { titleQuery, authorQuery, tagsQuery, ratingQuery } = queryParams;
    
    // Build the same search logic as searchHandler.js
    const whereClauses = [];
    
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
    
    if (ratingQuery) {
        whereClauses.push({ rating: { [Op.iLike]: `%${ratingQuery.trim()}%` } });
    }
    
    if (tagsQuery) {
        const searchTagFields = ['tags', 'archive_warnings', 'character_tags', 'fandom_tags', 'additionalTags'];
        
        let orGroups;
        if (tagsQuery.includes(' OR ')) {
            orGroups = tagsQuery.split(' OR ').map(group => group.trim()).filter(Boolean);
        } else {
            orGroups = tagsQuery.split(',').map(group => group.trim()).filter(Boolean);
        }
        
        const tagOrClauses = [];
        for (const group of orGroups) {
            const groupClauses = [];
            let workingGroup = group;
            
            const notClauses = [];
            
            // Extract NOT terms (new syntax)
            const notMatches = workingGroup.match(/\\bNOT\\s+([^\\s]+(?:\\s+[^\\s]+)*?)(?=\\s+(?:AND|OR|$)|$)/g);
            if (notMatches) {
                for (const notMatch of notMatches) {
                    const notTag = notMatch.replace(/^NOT\\s+/, '').trim().toLowerCase();
                    if (notTag) {
                        const notConditions = createTagSearchConditions(notTag, Op.notILike, searchTagFields);
                        notClauses.push({ [Op.and]: notConditions });
                    }
                    workingGroup = workingGroup.replace(notMatch, '').trim();
                }
            }
            
            // Extract legacy NOT terms (- prefix)
            const legacyNotMatches = workingGroup.match(/-([^,+\\s]+)/g);
            if (legacyNotMatches) {
                for (const legacyNotMatch of legacyNotMatches) {
                    const notTag = legacyNotMatch.substring(1).toLowerCase();
                    if (notTag) {
                        const notConditions = createTagSearchConditions(notTag, Op.notILike, searchTagFields);
                        notClauses.push({ [Op.and]: notConditions });
                    }
                    workingGroup = workingGroup.replace(legacyNotMatch, '').trim();
                }
            }
            
            workingGroup = workingGroup.replace(/\\s+/g, ' ').trim();
            
            if (workingGroup.includes(' AND ')) {
                const andTags = workingGroup.split(' AND ').map(t => t.trim().toLowerCase()).filter(Boolean);
                if (andTags.length > 0) {
                    const andClauses = andTags.map(tag => {
                        const tagConditions = createTagSearchConditions(tag, Op.iLike, searchTagFields);
                        return { [Op.or]: tagConditions };
                    });
                    groupClauses.push({ [Op.and]: andClauses });
                }
            } else if (workingGroup.includes('+')) {
                const andTags = workingGroup.split('+').map(t => t.trim().toLowerCase()).filter(Boolean);
                if (andTags.length > 0) {
                    const andClauses = andTags.map(tag => {
                        const tagConditions = createTagSearchConditions(tag, Op.iLike, searchTagFields);
                        return { [Op.or]: tagConditions };
                    });
                    groupClauses.push({ [Op.and]: andClauses });
                }
            } else if (workingGroup.length) {
                const tag = workingGroup.toLowerCase();
                const tagConditions = createTagSearchConditions(tag, Op.iLike, searchTagFields);
                groupClauses.push({ [Op.or]: tagConditions });
            }
            
            const allGroupClauses = [...groupClauses, ...notClauses];
            if (allGroupClauses.length === 1) {
                tagOrClauses.push(allGroupClauses[0]);
            } else if (allGroupClauses.length > 1) {
                tagOrClauses.push({ [Op.and]: allGroupClauses });
            }
        }
        
        if (tagOrClauses.length === 1) {
            whereClauses.push(tagOrClauses[0]);
        } else if (tagOrClauses.length > 1) {
            whereClauses.push({ [Op.or]: tagOrClauses });
        }
    }
    
    // Perform the search with all the same logic as searchHandler
    const allResultsRaw = await Recommendation.findAll({
        where: whereClauses.length > 0 ? { [Op.and]: whereClauses } : {},
        order: [['updatedAt', 'DESC']],
        limit: 25
    });
    
    // Deduplicate by URL
    const seen = new Set();
    const allResults = allResultsRaw.filter(rec => {
        const key = rec.url || rec.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    const perPage = 3;
    const recs = allResults.slice((page - 1) * perPage, page * perPage);
    
    // Build display query for user feedback
    const queryParts = [];
    if (titleQuery) queryParts.push(`title:"${titleQuery}"`);
    if (authorQuery) queryParts.push(`author:"${authorQuery}"`);
    if (tagsQuery) queryParts.push(`tags:"${tagsQuery}"`);
    if (ratingQuery) queryParts.push(`rating:"${ratingQuery}"`);
    const displayQuery = queryParts.join(' ');
    
    const embed = createSearchResultsEmbed(recs, page, totalPages, displayQuery);
    const row = await buildSearchPaginationRow(page, totalPages, 'recsearch', queryParams);
    
    await interaction.update({
        embeds: [embed],
        components: totalPages > 1 ? [row] : [],
        content: `Here are your search results for ${displayQuery}:`
    });
    
    } catch (error) {
        console.error('[Search Pagination] Error:', error);
        try {
            await interaction.update({ 
                content: 'Something went wrong processing that search page. Please try your search again.',
                embeds: [],
                components: []
            });
        } catch (updateError) {
            console.error('[Search Pagination] Failed to send error message:', updateError);
        }
    }
}

export default handleSearchPagination;

