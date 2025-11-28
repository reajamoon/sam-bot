
import Discord from 'discord.js';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import crypto from 'crypto';
import { sequelize } from '../../models/index.js';

// Use PostgreSQL for persistent search query caching

/**
 * Builds a row of pagination buttons for search results.
 * @param {number} page - Current page (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {string} customIdBase - Unique base for custom IDs (e.g., 'recsearch')
 * @param {Object} queryData - The search query parameters object
 * @returns {Promise<ActionRowBuilder>}
 */
async function buildSearchPaginationRow(page, totalPages, customIdBase = 'recsearch', queryData = null) {
    let queryId = '';
    
    // If we have query data, create a short hash and cache it in database
    if (queryData && typeof queryData === 'object') {
        const queryString = JSON.stringify(queryData);
        queryId = crypto.createHash('md5').update(queryString).digest('hex').substring(0, 8);
        
        // Cache the query data in PostgreSQL with 30-minute expiration
        try {
            await sequelize.query(`
                INSERT INTO search_cache (query_id, query_data, expires_at)
                VALUES (:queryId, :queryData, NOW() + INTERVAL '30 minutes')
                ON CONFLICT (query_id) DO UPDATE SET
                    query_data = EXCLUDED.query_data,
                    expires_at = EXCLUDED.expires_at
            `, {
                replacements: {
                    queryId,
                    queryData: queryString  // Use queryString, not JSON.stringify(queryData) again
                }
            });
            
            // Occasional cleanup of expired entries (5% chance)
            if (Math.random() < 0.05) {
                await sequelize.query('DELETE FROM search_cache WHERE expires_at < NOW()');
            }
        } catch (error) {
            console.error('Error caching search query:', error);
            // Fall back to a simple hash if database fails
        }
    } else if (typeof customIdBase === 'string' && customIdBase.includes(':')) {
        // Legacy handling - extract query from customIdBase
        const parts = customIdBase.split(':');
        if (parts.length > 1) {
            queryId = parts[1];
            customIdBase = parts[0];
        }
    }
    
    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:first:${queryId}:${page}:${totalPages}`)
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:prev:${queryId}:${page}:${totalPages}`)
            .setLabel('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:next:${queryId}:${page}:${totalPages}`)
            .setLabel('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:last:${queryId}:${page}:${totalPages}`)
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages)
    );
    return row;
}

/**
 * Retrieves cached query data by ID
 * @param {string} queryId - The hashed query ID
 * @returns {Promise<Object|null>} - The cached query data or null if not found/expired
 */
async function getCachedQuery(queryId) {
    try {
        const [results] = await sequelize.query(`
            SELECT query_data 
            FROM search_cache 
            WHERE query_id = :queryId AND expires_at > NOW()
        `, {
            replacements: { queryId }
        });
        
        if (results.length === 0) {
            return null;
        }
        
        try {
            return JSON.parse(results[0].query_data);
        } catch (parseError) {
            // If JSON parsing fails, this is a corrupted entry - delete it
            console.warn(`Removing corrupted cache entry for queryId ${queryId}`);
            await sequelize.query(`
                DELETE FROM search_cache WHERE query_id = :queryId
            `, {
                replacements: { queryId }
            });
            return null;
        }
    } catch (error) {
        console.error('Error retrieving cached query:', error);
        return null;
    }
}

export { buildSearchPaginationRow, getCachedQuery };
