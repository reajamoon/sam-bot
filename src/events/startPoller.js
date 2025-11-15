const POLL_INTERVAL_MS = 10000;
const { ParseQueue, ParseQueueSubscriber, User, Config } = require('../models');
const createRecommendationEmbed = require('../utils/recUtils/createRecommendationEmbed');

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
            if (job.result && job.result.title) {
                try {
                    const rec = {
                        ...job.result,
                        url: job.fic_url,
                        id: job.id
                    };
                    embed = await createRecommendationEmbed(rec);
                } catch (err) {
                    console.error('Failed to build embed with createRecommendationEmbed:', err);
                }
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
            const mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).join(' ');
            try {
                await channel.send({
                    content: `>>> ${mentionList ? mentionList + ' ' : ''}Your fic parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : ''),
                });
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
    setInterval(() => notifyQueueSubscribers(client), POLL_INTERVAL_MS || 10000);
    console.log('Fic queue notification poller started.');
};
