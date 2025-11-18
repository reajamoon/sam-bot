// Finds a rec by ID, URL, or AO3 work number. If you pass in more than one, expect sass.
const { Op } = require('sequelize');
const updateMessages = require('../text/updateMessages');


/**
 * Finds a recommendation by a single identifier (ID, URL, or AO3 Work ID as string).
 * @param {object} interaction - Discord interaction object
 * @param {string} identifier - ID, URL, or AO3 Work ID
 * @returns {Promise<object>} Recommendation instance
 * @throws {Error} If not found or invalid input
 */
async function findRecommendationByIdOrUrl(interaction, identifier) {
    const normalizeAO3Url = require('./normalizeAO3Url');
    const { Recommendation } = require('../../models');
    console.log('DEBUG Recommendation import:', {
        type: typeof Recommendation,
        keys: Recommendation && Object.keys(Recommendation),
        isFunction: typeof Recommendation === 'function',
        isObject: typeof Recommendation === 'object',
        hasFindOne: Recommendation && typeof Recommendation.findOne === 'function'
    });
    // Debug: log actual value received
    console.log('[findRecommendationByIdOrUrl] identifier:', identifier);
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
        throw new Error(updateMessages.needIdentifier);
    }
    let recommendation = null;
    // Try as integer ID
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

module.exports = findRecommendationByIdOrUrl;
