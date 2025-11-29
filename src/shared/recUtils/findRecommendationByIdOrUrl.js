// Finds a rec by ID, URL, or AO3 work number. If you pass in more than one, expect sass.

import { Op } from 'sequelize';
import updateMessages from '../text/updateMessages.js';
import normalizeAO3Url from './normalizeAO3Url.js';
import { Recommendation, Series } from '../../models/index.js';


/**
 * Finds a recommendation by a single identifier (ID, URL, or AO3 Work ID as string).
 * @param {object} interaction - Discord interaction object
 * @param {string} identifier - ID, URL, or AO3 Work ID
 * @returns {Promise<object>} Recommendation instance
 * @throws {Error} If not found or invalid input
 */

async function findRecommendationByIdOrUrl(interaction, identifier) {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
        throw new Error(updateMessages.needIdentifier);
    }
    let recommendation = null;
    
    // Check for series ID with S prefix (e.g., S123)
    if (/^S\d+$/i.test(identifier)) {
        const seriesIdNum = parseInt(identifier.substring(1), 10);
        const series = await Series.findOne({ where: { id: seriesIdNum } });
        if (series) {
            // Find any recommendation from this series to represent it
            recommendation = await Recommendation.findOne({ 
                where: { ao3SeriesId: series.ao3SeriesId } 
            });
            if (recommendation) return recommendation;
        }
    }
    
    // Try as integer ID for recommendations
    if (/^\d+$/.test(identifier)) {
        const idNum = parseInt(identifier, 10);
        recommendation = await Recommendation.findOne({ where: { id: idNum } });
        if (recommendation) return recommendation;
    }
    // Try as AO3 Work ID (if identifier is a number and not found as rec ID)
    if (/^\d+$/.test(identifier)) {
        recommendation = await Recommendation.findOne({
            where: {
                url: {
                    [Op.like]: `%archiveofourown.org/works/${identifier}%`
                }
            }
        });
        if (recommendation) return recommendation;
    }
    // Try as URL
    if (/^https?:\/\//.test(identifier)) {
        const normalizedUrl = normalizeAO3Url(identifier);
        recommendation = await Recommendation.findOne({ where: { url: normalizedUrl } });
        if (recommendation) return recommendation;
    }
    // Try as exact case-sensitive title
    recommendation = await Recommendation.findOne({ where: { title: identifier } });
    if (recommendation) return recommendation;
    throw new Error(updateMessages.notFound(identifier));
}

export default findRecommendationByIdOrUrl;
