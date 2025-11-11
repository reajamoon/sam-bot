// queueWorker.js
// Background worker to process fic parsing jobs from the ParseQueue
const { sequelize, ParseQueue, ParseQueueSubscriber, Recommendation, Config } = require('./src/models');
const processRecommendationJob = require('./src/utils/recUtils/processRecommendationJob');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

async function processQueueJob(job) {
  try {
    await job.update({ status: 'processing' });
    // Use the original requester's user context for the rec
    // Try to get the username from the first subscriber, fallback to 'Unknown User'
    let user = { id: job.requested_by || 'queue', username: 'Unknown User' };
    const firstSub = await ParseQueueSubscriber.findOne({ where: { queue_id: job.id }, order: [['created_at', 'ASC']] });
    if (firstSub) {
      // Try to get username from User table
      const { User } = require('./src/models');
      const userRecord = await User.findOne({ where: { discordId: firstSub.user_id } });
      user = {
        id: firstSub.user_id,
        username: userRecord ? userRecord.username : `User ${firstSub.user_id}`
      };
    }
    await processRecommendationJob({
      url: job.fic_url,
      user,
      manualFields: {},
      additionalTags: [],
      notes: '',
      isUpdate: false,
      notify: async (embedOrError) => {
        if (!embedOrError || embedOrError.error) {
          await job.update({ status: 'error', error_message: embedOrError?.error || 'Unknown error' });
          return;
        }
        await job.update({ status: 'done', result: embedOrError.recommendation, error_message: null });
        // Notify all subscribers in the configured channel
        const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
        const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
        if (!configEntry) {
          console.warn('[QueueWorker] No fic_queue_channel configured. Skipping notification.');
          return;
        }
        const channelId = configEntry.value;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          console.warn(`[QueueWorker] Could not fetch or use channel ${channelId}. Skipping notification.`);
          return;
        }
        const mentions = subscribers.map(sub => `<@${sub.user_id}>`).join(' ');
        await channel.send({
          content: `${mentions}\nYour fic parsing job for <${job.fic_url}> is complete!`,
          embeds: [embedOrError.embed || embedOrError]
        });
        // Clean up subscribers after notification
        await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
      }
    });
  } catch (err) {
    await job.update({ status: 'error', error_message: err.message });
    console.error('[QueueWorker] Error processing job:', err);
  }
}

async function pollQueue() {
  while (true) {
    try {
      await sequelize.sync();
      const job = await ParseQueue.findOne({ where: { status: 'pending' }, order: [['created_at', 'ASC']] });
      if (job) {
        await processQueueJob(job);
      } else {
        // No pending jobs, wait before polling again
        await new Promise(res => setTimeout(res, 5000));
      }
    } catch (err) {
      console.error('[QueueWorker] Polling error:', err);
      await new Promise(res => setTimeout(res, 10000));
    }
  }
}

client.once('ready', () => {
  console.log('[QueueWorker] Discord client ready. Starting queue polling...');
  pollQueue();
});

client.login(process.env.BOT_TOKEN);
