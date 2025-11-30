import { ModLock } from '../models/index.js';

/**
 * Get locked fields for a specific series
 * @param {Object} series - Series model instance
 * @returns {Set<string>} - Set of locked field names
 */
export async function getLockedFieldsForSeries(series) {
    if (!series || !series.ao3SeriesId) {
        return new Set();
    }

    try {
        const modLocks = await ModLock.findAll({
            where: {
                seriesId: String(series.ao3SeriesId),
                // For series, we use seriesId field instead of ao3ID
                // Convert to string to match database column type
            }
        });

        const lockedFields = new Set();
        for (const lock of modLocks) {
            if (lock.field === 'ALL') {
                lockedFields.add('ALL');
            } else {
                lockedFields.add(lock.field);
            }
        }

        return lockedFields;
    } catch (error) {
        console.error('[getLockedFieldsForSeries] Error:', error);
        return new Set();
    }
}