// Utility to fetch all locked fields for a given recommendation or series from ModLock
import { ModLock, Series, User } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Returns a Set of all locked fields for a given recommendation.
 * Looks up locks by ao3ID and AO3 series ID.
 * Includes 'ALL' if the whole rec is locked.
 * @param {Object} recommendation - Recommendation object with ao3ID and seriesID
 * @returns {Promise<Set<string>>}
 */
export async function getLockedFieldsForRec(recommendation, requestingUser = null) {
  if (!recommendation) return new Set();

  // Mod locks apply only to members; staff bypass all locks
  try {
    if (requestingUser && requestingUser.id) {
      const userRecord = await User.findOne({ where: { discordId: requestingUser.id } });
      const level = (userRecord?.permissionLevel || 'member').toLowerCase();
      if (level !== 'member') {
        return new Set();
      }
    }
  } catch (e) {
    // On lookup failure, treat as member (locks apply)
  }
  
  const whereConditions = [];
  
  // Add condition for ao3ID if it exists
  if (recommendation.ao3ID) {
    whereConditions.push({ ao3ID: String(recommendation.ao3ID) });
  }
  
  // Add condition for AO3 series ID if recommendation has a seriesId  
  if (recommendation.seriesId) {
    // Get the AO3 series ID from the Series table
    const series = await Series.findByPk(recommendation.seriesId);
    if (series && series.ao3SeriesId) {
      whereConditions.push({ seriesId: String(series.ao3SeriesId) });
    }
  }
  
  // If no identifiers, return empty set
  if (whereConditions.length === 0) return new Set();
  
  const locks = await ModLock.findAll({
    where: {
      [Op.or]: whereConditions,
      locked: true
    },
    attributes: ['field'],
  });
  
  return new Set(locks.map(l => l.field));
}