import { Op } from 'sequelize';
import { ParseQueue, ParseQueueSubscriber, User, Config, Recommendation } from '../../../models/index.js';
import { createRecommendationEmbed } from '../../../shared/recUtils/asyncEmbeds.js';

const POLL_INTERVAL_MS = 10000;

async function notifyQueueSubscribers(client) {
    try {
        // Notify for jobs that failed Dean/Cas validation (nOTP)
        const nOTPJobs = await ParseQueue.findAll({
            where: { status: 'nOTP' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        for (const job of nOTPJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            // Fetch modmail channel from config
            const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
            const modmailChannelId = modmailConfig ? modmailConfig.value : null;
            if (!modmailChannelId) {
                console.warn(`[Poller] No modmail_channel_id configured; skipping modmail notification for nOTP job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            const modmailChannel = client.channels.cache.get(modmailChannelId);
            if (!modmailChannel) {
                console.warn(`[Poller] Modmail channel ${modmailChannelId} not found; skipping notification for nOTP job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            let contentMsg = `Hey mods, I caught a fic that doesn't look like it fits rec guidelines. Can you take a look?`;
            contentMsg += `\n\n🔗 <${job.fic_url}>`;
            if (job.validation_reason) contentMsg += `\n**Validation reason:** ${job.validation_reason}`;
            // Always mention the original submitter (requested_by)
            let submitterMention = '';
            if (job.requested_by) {
                // requested_by may be a comma-separated list, but we only expect one for single recs
                const submitterId = job.requested_by.split(',')[0].trim();
                if (submitterId) submitterMention = `<@${submitterId}>`;
            }
            // Also mention any subscribers (if present and not duplicate)
            let mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).filter(m => m !== submitterMention);
            let allMentions = submitterMention;
            if (mentionList.length) allMentions += (allMentions ? ' ' : '') + mentionList.join(' ');
            if (allMentions) contentMsg += `\n**Submitted by:** ${allMentions}`;
            contentMsg += `\n\nIf this was flagged by mistake, you can approve it manually. Otherwise, you can let the member know why their fic was bounced by using @relay in this thread.`;
            try {
                // Try to get fic title from Recommendation if it exists
                let threadTitle = null;
                const rec = await Recommendation.findOne({ where: { url: job.fic_url } });
                if (rec && rec.title) {
                    threadTitle = `Rec Validation: ${rec.title.substring(0, 80)}`;
                } else {
                    // Fallback: use fic URL (truncated)
                    threadTitle = `Rec Validation: ${job.fic_url.substring(0, 60)}`;
                }
                const sentMsg = await modmailChannel.send({ content: contentMsg });
                // Create a thread for this modmail
                const thread = await sentMsg.startThread({
                    name: threadTitle,
                    autoArchiveDuration: 1440, // 24 hours
                    reason: 'AO3 rec validation failed (nOTP)'
                });
            } catch (err) {
                console.error('[Poller] Failed to send modmail notification or create thread for nOTP job:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            await ParseQueue.destroy({ where: { id: job.id } });
        }

        // Notify for completed jobs
        const doneJobs = await ParseQueue.findAll({
            where: { status: 'done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        for (const job of doneJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            // Always fetch Recommendation from the database for DONE jobs
            let embed = null;
            let recWithSeries = null;
            if (job.result && job.result.id) {
                // Use fetchRecWithSeries to get rec, series, and series works
                const { fetchRecWithSeries } = await import('../../../models/fetchRecWithSeries.js');
                recWithSeries = await fetchRecWithSeries(job.result.id, true);
                // Handle case where job.result.id might be a series ID instead of rec ID (old job format)
                if (!recWithSeries && job.result.type === 'series' && job.result.seriesId) {
                    // Try to find the primary recommendation for this series
                    const { Recommendation } = await import('../../../models/index.js');
                    const primaryRec = await Recommendation.findOne({
                        where: {
                            seriesId: job.result.seriesRecord?.ao3SeriesId || null,
                            notPrimaryWork: false
                        }
                    });
                    if (primaryRec) {
                        recWithSeries = await fetchRecWithSeries(primaryRec.id, true);
                    }
                }
            }
            if (recWithSeries) {
                // Check if this is a series result (either marked as series type or has series data)
                const isSeriesResult = job.result.type === 'series' ||
                    (recWithSeries.series && Array.isArray(recWithSeries.series.works) && recWithSeries.series.works.length > 0);
                if (isSeriesResult && recWithSeries.series) {
                    // Use series embed mode
                    embed = await createRecommendationEmbed(null, recWithSeries.series, recWithSeries.series.works);
                } else {
                    // Use regular recommendation embed
                    embed = await createRecommendationEmbed(recWithSeries);
                }
            } else {
                console.warn(`[Poller] No Recommendation found for rec ID: ${job.result && job.result.id} (job id: ${job.id}, url: ${job.fic_url})`);
                // Skip this notification since we can't create an embed
                continue;
            }
            const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
            const channelId = configEntry ? configEntry.value : null;
            if (!channelId) {
                console.warn(`[Poller] No fic_queue_channel configured; skipping queue notifications for job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.warn(`[Poller] Fic queue notification channel ${channelId} not found; skipping notification for job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }
            // For instant_candidate jobs, do not @mention users, but still send embed
            let contentMsg = `Your fic parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : '');
            if (!job.instant_candidate && users.length) {
                const mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).join(' ');
                if (mentionList) contentMsg = `>>> ${mentionList} ` + contentMsg;
            }
            // Always log when a done job is being processed for notification
            console.log(`[Poller] Processing done job: job id ${job.id}, url: ${job.fic_url}, subscribers: [${subscribers.map(s => s.user_id).join(', ')}]`);
            try {
                console.log('[Poller DEBUG] About to send notification:', {
                    channelId,
                    channelFound: !!channel,
                    clientUser: client.user ? client.user.tag : null,
                    jobId: job.id,
                    jobUrl: job.fic_url,
                    subscribers: subscribers.map(s => s.user_id),
                    users: users.map(u => u.discordId),
                    contentMsg,
                    embedExists: !!embed
                });
                await channel.send({ content: contentMsg });
                if (embed) {
                    await channel.send({ embeds: [embed] });
                } else {
                    console.warn(`[Poller] No embed built for job id: ${job.id}, url: ${job.fic_url}`);
                }
            } catch (err) {
                console.error('[Poller] Failed to send fic queue notification:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            // Delete the job after notification to prevent repeated alerts
            await ParseQueue.destroy({ where: { id: job.id } });
        }
    } catch (err) {
        console.error('Error in queue notification poller:', err);
    }
}


export default function startPoller(client) {
    // Helper: Notify users if their job was dropped due to being stuck (not normal 3-hour cleanup)
    async function notifyDroppedQueueJobs() {
        // Only notify for jobs that were stuck in 'pending' or 'processing' and dropped as 'error' with a stuck message
        const droppedJobs = await ParseQueue.findAll({
            where: {
                status: 'error',
                error_message: { [Op.iLike]: '%stuck%' }
            }
        });
        for (const job of droppedJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            for (const sub of subscribers) {
                const user = await User.findOne({ where: { discordId: sub.user_id } });
                if (user && user.queueNotifyTag !== false) {
                    const dmUser = await client.users.fetch(sub.user_id).catch(() => null);
                    if (dmUser) {
                        await dmUser.send({
                            content: `Hey, just a heads up—your fic parsing job for <${job.fic_url}> got stuck in the queue and I had to drop it. Sometimes the stacks get a little weird, but you can always try again.\n\nIf you want to turn off these DMs, just use the \`/rec notifytag\` command. (And if you have questions, you know where to find me.)`
                        });
                    }
                }
            }
            await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            await ParseQueue.destroy({ where: { id: job.id } });
        }
    }

    setInterval(() => {
        notifyQueueSubscribers(client);
        notifyDroppedQueueJobs();
    }, POLL_INTERVAL_MS || 10000);
    console.log('Fic queue notification poller started.');
}
