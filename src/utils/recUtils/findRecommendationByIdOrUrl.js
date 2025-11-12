// Finds a rec by ID, URL, or AO3 work number. If you pass in more than one, expect sass.
const { Op } = require('sequelize');

/**
 * Finds a recommendation by ID, URL, or AO3 Work ID. Only one at a time, please.
 * @param {object} interaction - Discord interaction object
 * @param {number|null} recId - Recommendation ID
 * @param {string|null} recUrl - Recommendation URL
 * @param {number|null} ao3Id - AO3 Work ID
 * @returns {Promise<object>} Recommendation instance
 * @throws {Error} If not found or invalid input
 */
async function findRecommendationByIdOrUrl(interaction, recId, recUrl, ao3Id) {
    const normalizeAO3Url = require('./normalizeAO3Url');
    const { Recommendation } = require('../../models');
    console.log('DEBUG Recommendation import:', {
        type: typeof Recommendation,
        keys: Recommendation && Object.keys(Recommendation),
        isFunction: typeof Recommendation === 'function',
        isObject: typeof Recommendation === 'object',
        hasFindOne: Recommendation && typeof Recommendation.findOne === 'function'
    });
    // Count how many identifiers are provided (robust: only count positive integers for IDs, non-empty string for URL)
    const idValid = typeof recId === 'number' && Number.isInteger(recId) && recId > 0;
    const urlValid = typeof recUrl === 'string' && recUrl.trim().length > 0;
    const ao3Valid = typeof ao3Id === 'number' && Number.isInteger(ao3Id) && ao3Id > 0;
    const identifierCount = [idValid, urlValid, ao3Valid].filter(Boolean).length;
    if (identifierCount === 0) {
        throw new Error('You need to provide either an ID, URL, or AO3 Work ID to find the recommendation.');
    }
    if (identifierCount > 1) {
        throw new Error('Please provide only one identifier: either an ID, URL, or AO3 Work ID.');
    }
    let recommendation;
    if (idValid) {
        recommendation = await Recommendation.findOne({
            where: {
                id: recId
            }
        });
        if (!recommendation) {
            throw new Error(`I couldn't find a recommendation with ID ${recId} in our library.`);
        }
    } else if (urlValid) {
        // Normalize AO3 URLs for lookup
        const normalizedUrl = normalizeAO3Url(recUrl);
        recommendation = await Recommendation.findOne({
            where: {
                url: normalizedUrl
            }
        });
        if (!recommendation) {
            throw new Error(`I couldn't find a recommendation with that URL in our library. Make sure you're using the exact URL that was originally added.`);
        }
    } else if (ao3Valid) {
        recommendation = await Recommendation.findOne({
            where: {
                url: {
                    [Op.like]: `%archiveofourown.org/works/${ao3Id}%`
                }
            }
        });
        if (!recommendation) {
            throw new Error(`I couldn't find an AO3 recommendation with Work ID ${ao3Id} in our library. Make sure the work ID is correct and that the fic has been added to our collection.`);
        }
    }
    return recommendation;
}

module.exports = findRecommendationByIdOrUrl;
