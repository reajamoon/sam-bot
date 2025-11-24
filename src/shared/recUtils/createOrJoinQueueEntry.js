
import updateMessages from '../text/updateMessages.js';
import { ParseQueue, ParseQueueSubscriber, Config } from '../../models/index.js';

/**
 * Attempts to create a new queue entry for the given fic URL, or joins the existing one if it already exists.
 * Handles race conditions and subscribes the user for notifications.
 * @param {string} ficUrl - The normalized fic URL.
 * @param {string} userId - The Discord user ID.
 * @returns {Promise<{queueEntry: object, status: string, message?: string}>}
 */
async function createOrJoinQueueEntry(ficUrl, userId) {
    // Only mark as instant_candidate if there are no other pending/processing jobs
    const activeJobs = await ParseQueue.count({ where: { status: ['pending', 'processing'] } });
    const isInstant = activeJobs === 0;
    let queueEntry;
    try {
        queueEntry = await ParseQueue.create({
            fic_url: ficUrl,
            status: 'pending',
            requested_by: userId,
            instant_candidate: isInstant
        });
    } catch (err) {
        // Handle race condition: duplicate key error (Sequelize or raw pg)
        if ((err && err.code === '23505') || (err && err.name === 'SequelizeUniqueConstraintError')) {
            queueEntry = await ParseQueue.findOne({ where: { fic_url: ficUrl } });
            if (queueEntry) {
                // Subscribe user if not already
                const existingSub = await ParseQueueSubscriber.findOne({ where: { queue_id: queueEntry.id, user_id: userId } });
                if (!existingSub) {
                    await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: userId });
                }
                // Return appropriate status and message
                if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
                    return { queueEntry, status: 'processing', message: updateMessages.alreadyProcessing };
                } else if (queueEntry.status === 'done' && queueEntry.result) {
                    return { queueEntry, status: 'done', message: null };
                } else if (queueEntry.status === 'error') {
                    return { queueEntry, status: 'error', message: updateMessages.errorPreviously };
                } else {
                    return { queueEntry, status: 'other', message: updateMessages.alreadyInQueue };
                }
            }
        }
        throw err;
    }
    // Subscribe user to the new queue entry
    await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: userId });
    return { queueEntry, status: 'created', message: null };
}


export default createOrJoinQueueEntry;
