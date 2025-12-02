import { Op } from 'sequelize';
import { ParseQueue, ParseQueueSubscriber, User, Config, Recommendation } from '../../../models/index.js';
import { createRecEmbed } from '../../../shared/recUtils/createRecEmbed.js';
import { createSeriesEmbed } from '../../../shared/recUtils/createSeriesEmbed.js';

const POLL_INTERVAL_MS = 10000;

async function notifyQueueSubscribers(client) {
    // Heartbeat counters for this cycle
    let heartbeat_n = 0;
    let heartbeat_done = 0;
    let heartbeat_series_done = 0;
    let heartbeat_error = 0;
    try {
        // Notify for jobs that failed Dean/Cas validation (nOTP)
        const nOTPJobs = await ParseQueue.findAll({
            where: { status: 'nOTP' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_n = nOTPJobs.length;
        for (const job of nOTPJobs) {
            // Skip if we've already sent a modmail for this nOTP job
            if (job.result && job.result.notified) {
                continue;
            }
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
            if (allMentions) {
                contentMsg += `\n**Submitted by:** ${allMentions}`;
            } else {
                // Fallback when no submitter or subscribers are present
                contentMsg += `\n**Submitted by:** Unknown`;
            }
            contentMsg += `\n\nIf this got flagged by mistake, go ahead and approve it. Otherwise, use @relay in this thread and I’ll pass a note to them about why it got bounced.`;
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
                // Send action buttons inside the thread for intuitive mod actions
                try {
                    // Compose a detailed thread summary to preserve mod relay expectations
                    let threadSummary = `🔗 <${job.fic_url}>`;
                    if (job.validation_reason) threadSummary += `\n**Validation reason:** ${job.validation_reason}`;
                    // Build submitter + subscribers mention list similar to channel message
                    let submitterMention = '';
                    if (job.requested_by) {
                        const submitterId = job.requested_by.split(',')[0].trim();
                        if (submitterId) submitterMention = `<@${submitterId}>`;
                    }
                    const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
                    const userIds = subscribers.map(s => s.user_id);
                    const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
                    let mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).filter(m => m !== submitterMention);
                    let allMentions = submitterMention;
                    if (mentionList.length) allMentions += (allMentions ? ' ' : '') + mentionList.join(' ');
                    if (allMentions) {
                        threadSummary += `\n**Submitted by:** ${allMentions}`;
                    } else {
                        threadSummary += `\n**Submitted by:** Unknown`;
                    }
                    await thread.send({ content: threadSummary });
                    // Try to include a compact summary embed for context
                    try {
                        const rec = await Recommendation.findOne({ where: { url: job.fic_url } });
                        if (rec) {
                            const embed = createRecEmbed(rec);
                            await thread.send({ embeds: [embed] });
                        } else {
                            await thread.send({ content: `Context: <${job.fic_url}>` });
                        }
                    } catch (ctxErr) {
                        console.error('[Poller] Failed to send context embed in thread:', ctxErr);
                    }
                    await thread.send({
                        content: 'Mod tools:',
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        style: 3,
                                        label: 'Approve & requeue',
                                        custom_id: `notp_approve:${job.id}`
                                    },
                                    {
                                        type: 2,
                                        style: 2,
                                        label: 'Dismiss (keep nOTP)',
                                        custom_id: `notp_dismiss:${job.id}`
                                    }
                                ]
                            }
                        ]
                    });
                } catch (btnErr) {
                    console.error('[Poller] Failed to send mod buttons in thread:', btnErr);
                }
            } catch (err) {
                console.error('[Poller] Failed to send modmail notification or create thread for nOTP job:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            // After notifying, clear subscribers to avoid duplicate mentions, but keep the job
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            // Mark as notified so we don't spam modmail; keep status 'nOTP' for override command
            try {
                const existingResult = job.result && typeof job.result === 'object' ? job.result : {};
                await job.update({ result: { ...existingResult, notified: true } });
            } catch (err) {
                console.error('[Poller] Failed to mark nOTP job as notified:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
        }

        // Notify for completed jobs
        const doneJobs = await ParseQueue.findAll({
            where: { status: 'done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_done = doneJobs.length;
        
        // Notify for completed series jobs
        const seriesDoneJobs = await ParseQueue.findAll({
            where: { status: 'series-done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_series_done = seriesDoneJobs.length;

        // Optional: notify mods of error jobs to improve visibility
        const errorJobs = await ParseQueue.findAll({
            where: { status: 'error' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        heartbeat_error = errorJobs.length;
        for (const job of errorJobs) {
            try {
                const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
                const modmailChannelId = modmailConfig ? modmailConfig.value : null;
                if (!modmailChannelId) {
                    console.warn(`[Poller] No modmail_channel_id configured; skipping error notification for job id: ${job.id}, url: ${job.fic_url}`);
                } else {
                    const modmailChannel = client.channels.cache.get(modmailChannelId);
                    if (modmailChannel) {
                        const errMsg = job.error_message || 'Unknown error';
                        let contentMsg = `Heads up: a fic parsing job hit an error and was dropped.`;
                        contentMsg += `\n\n🔗 <${job.fic_url}>`;
                        contentMsg += `\n**Error:** ${errMsg}`;
                        const sent = await modmailChannel.send({ content: contentMsg });
                        // no thread for errors; keep noise low
                    }
                }
            } catch (err) {
                console.error('[Poller] Failed to send error notification for job:', err, `job id: ${job.id}, url: ${job.fic_url}`);
            }
            // Clean up subscribers and delete job
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            if (subscribers.length) {
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
            }
            await ParseQueue.destroy({ where: { id: job.id } });
        }
        
        // Process regular done jobs
        for (const job of doneJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            // Always fetch Recommendation from the database for DONE jobs
            let embed = null;
            let recWithSeries = null;
            // Handle different job types
            if (job.result && job.result.type === 'series' && job.result.seriesId) {
                // For series notifications, get the Series record with works and metadata
                const { fetchSeriesWithUserMetadata } = await import('../../../models/fetchSeriesWithUserMetadata.js');
                const series = await fetchSeriesWithUserMetadata(job.result.seriesId);
                if (series) {
                    embed = createSeriesEmbed(series);
                } else {
                    console.warn(`[Poller] No Series found for series ID: ${job.result.seriesId}`);
                    continue;
                }
            } else if (job.result && job.result.id) {
                // For individual recommendation notifications
                const { fetchRecWithSeries } = await import('../../../models/fetchRecWithSeries.js');
                recWithSeries = await fetchRecWithSeries(job.result.id, true);
                if (recWithSeries) {
                    // Use regular recommendation embed
                    embed = createRecEmbed(recWithSeries);
                } else {
                    console.warn(`[Poller] No Recommendation found for rec ID: ${job.result.id} (job id: ${job.id}, url: ${job.fic_url})`);
                    continue;
                }
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
        
        // Process series-done jobs
        for (const job of seriesDoneJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            const userIds = subscribers.map(s => s.user_id);
            const users = userIds.length ? await User.findAll({ where: { discordId: userIds } }) : [];
            
            let embed = null;
            // Handle series jobs - get series data and create series embed
            if (job.result && job.result.type === 'series' && job.result.seriesId) {
                const { fetchSeriesWithUserMetadata } = await import('../../../models/fetchSeriesWithUserMetadata.js');
                const series = await fetchSeriesWithUserMetadata(job.result.seriesId);
                if (series) {
                    embed = createSeriesEmbed(series);
                } else {
                    console.warn(`[Poller] No Series found for series ID: ${job.result.seriesId}`);
                    continue;
                }
            } else {
                console.warn(`[Poller] Invalid series-done job result:`, job.result);
                continue;
            }

            // Send notification
            const { Config } = await import('../../../models/index.js');
            const queueChannelConfig = await Config.findOne({ where: { key: 'queue_notification_channel' } });
            const channelId = queueChannelConfig ? queueChannelConfig.value : null;
            const channel = channelId ? client.channels.cache.get(channelId) : null;
            if (!channel) {
                console.warn(`[Poller] Queue notification channel not found or configured. Job id: ${job.id}, url: ${job.fic_url}`);
                continue;
            }

            try {
                let contentMsg = `Your series parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : '');
                if (!job.instant_candidate && users.length) {
                    const mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).join(' ');
                    if (mentionList) contentMsg = `>>> ${mentionList} ` + contentMsg;
                }
                
                console.log(`[Poller] Processing series-done job: job id ${job.id}, url: ${job.fic_url}, subscribers: [${subscribers.map(s => s.user_id).join(', ')}]`);
                
                await channel.send({ content: contentMsg });
                if (embed) {
                    await channel.send({ embeds: [embed] });
                } else {
                    console.warn(`[Poller] No series embed built for job id: ${job.id}, url: ${job.fic_url}`);
                }
            } catch (err) {
                console.error('[Poller] Failed to send series queue notification:', err, `job id: ${job.id}, url: ${job.fic_url}`);
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
    // Heartbeat: summarize this cycle's job counts
    console.log(`[Poller] Heartbeat — nOTP: ${heartbeat_n}, done: ${heartbeat_done}, series-done: ${heartbeat_series_done}, error: ${heartbeat_error}`);
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
