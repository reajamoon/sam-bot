import { ModLock, User } from '../models/index.js';

/**
 * Get locked fields for a specific series, respecting the requesting user's level.
 * Users with higher permission levels can bypass lower-level locks.
 * @param {Object} series - Series model instance
 * @param {{ id: string }} [requestingUser] - Discord user initiating the update
 * @returns {Promise<Set<string>>} - Set of locked field names applicable to the user
 */
export async function getLockedFieldsForSeries(series, requestingUser = null) {
    if (!series || !series.ao3SeriesId) {
        return new Set();
    }

    // Resolve requesting user's permission level (defaults to 'mod')
    let userLevel = 'mod';
    try {
        if (requestingUser && requestingUser.id) {
            const userRecord = await User.findOne({ where: { discordId: requestingUser.id } });
            if (userRecord && typeof userRecord.permissionLevel === 'string') {
                userLevel = userRecord.permissionLevel.toLowerCase();
            }
        }
    } catch (err) {
        // Non-fatal: if user lookup fails, fall back to lowest level
        console.error('[getLockedFieldsForSeries] Failed to resolve user level:', err);
    }

    // Business rule: Mod locks apply only to members; staff bypass all locks
    if (userLevel !== 'member') {
        return new Set();
    }

    try {
        const modLocks = await ModLock.findAll({
            where: {
                seriesId: String(series.ao3SeriesId),
                locked: true
            }
        });

        const lockedFields = new Set();
        for (const lock of modLocks) {
            // Determine if this lock should apply to the requesting user
            const lockLevel = (lock.lockLevel || 'mod').toLowerCase();
            const lockRank = levelRank[lockLevel] ?? 1;
            // If user's rank is lower than the lock's rank, lock applies; otherwise, user can bypass
            if (requestingRank < lockRank) {
                if (lock.field === 'ALL') {
                    lockedFields.add('ALL');
                } else {
                    lockedFields.add(lock.field);
                }
            }
        }

        return lockedFields;
    } catch (error) {
        console.error('[getLockedFieldsForSeries] Error:', error);
        return new Set();
    }
}