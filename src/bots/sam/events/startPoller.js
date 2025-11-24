const POLL_INTERVAL_MS = 10000;
const { ParseQueue, ParseQueueSubscriber, User, Config } = require('../../../models');
const createRecommendationEmbed = require('../../../shared/recUtils/createRecommendationEmbed');

async function notifyQueueSubscribers(client) {
    try {
        const doneJobs = await ParseQueue.findAll({
            where: { status: 'done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        for (const job of doneJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            if (!subscribers.length) continue;
            const userIds = subscribers.map(s => s.user_id);
            const users = await User.findAll({ where: { discordId: userIds } });
            let embed = null;
            // Always fetch the Recommendation by rec ID only
            const { Recommendation } = require('../../../models');
            let rec = null;
            if (job.result && job.result.id) {
                rec = await Recommendation.findByPk(job.result.id);
            }
            if (rec) {
                try {
                    embed = await createRecommendationEmbed(rec);
                } catch (err) {
                    console.error('Failed to build embed with createRecommendationEmbed:', err);
                }
            } else {
                console.warn(`No Recommendation found for rec ID: ${job.result && job.result.id}`);
            }
            const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
            const channelId = configEntry ? configEntry.value : null;
            if (!channelId) {
                console.warn('No fic_queue_channel configured; skipping queue notifications.');
                continue;
            }
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.warn(`Fic queue notification channel ${channelId} not found.`);
                continue;
            }
            // For instant_candidate jobs, do not @mention users, but still send embed
            let contentMsg = `Your fic parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : '');
            if (!job.instant_candidate) {
                const mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).join(' ');
                if (mentionList) contentMsg = `>>> ${mentionList} ` + contentMsg;
            }
            try {
                await channel.send({ content: contentMsg });
                if (embed) {
                    await channel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('Failed to send fic queue notification:', err);
            }
            await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
        }
    } catch (err) {
        console.error('Error in queue notification poller:', err);
    }
}

module.exports = (client) => {

    // Helper: Notify users if their job was dropped due to being stuck (not normal 3-hour cleanup)
    async function notifyDroppedQueueJobs() {
        const { Op } = require('sequelize');
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
};
