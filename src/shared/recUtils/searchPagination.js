
import Discord from 'discord.js';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import crypto from 'crypto';

// Simple in-memory cache for search queries (in production, you might want Redis)
const queryCache = new Map();

/**
 * Builds a row of pagination buttons for search results.
 * @param {number} page - Current page (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {string} customIdBase - Unique base for custom IDs (e.g., 'recsearch')
 * @param {Object} queryData - The search query parameters object
 * @returns {ActionRowBuilder}
 */
function buildSearchPaginationRow(page, totalPages, customIdBase = 'recsearch', queryData = null) {
    let queryId = '';
    
    // If we have query data, create a short hash and cache it
    if (queryData && typeof queryData === 'object') {
        const queryString = JSON.stringify(queryData);
        queryId = crypto.createHash('md5').update(queryString).digest('hex').substring(0, 8);
        
        // Cache the query data with expiration (30 minutes)
        queryCache.set(queryId, {
            data: queryData,
            expires: Date.now() + 30 * 60 * 1000
        });
        
        // Clean up expired entries occasionally
        if (Math.random() < 0.1) { // 10% chance to clean up
            for (const [key, value] of queryCache.entries()) {
                if (Date.now() > value.expires) {
                    queryCache.delete(key);
                }
            }
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
 * @returns {Object|null} - The cached query data or null if not found/expired
 */
function getCachedQuery(queryId) {
    const cached = queryCache.get(queryId);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
        queryCache.delete(queryId);
        return null;
    }
    
    return cached.data;
}

export { buildSearchPaginationRow, getCachedQuery };
