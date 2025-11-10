// queueWorker.js
// Background worker to process fic parsing jobs from the ParseQueue
const { sequelize, ParseQueue, ParseQueueSubscriber, Recommendation } = require('../src/models');
const { fetchFicMetadata } = require('../src/utils/recUtils/ficParser');
const createRecommendationEmbed = require('../src/utils/recUtils/createRecommendationEmbed');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

async function processQueueJob(job) {
  try {
    await job.update({ status: 'processing' });
    const metadata = await fetchFicMetadata(job.fic_url);
    if (!metadata || metadata.error) {
      await job.update({ status: 'error', error_message: metadata?.error || 'Unknown error' });
      return;
    }
    await job.update({ status: 'done', result: metadata, error_message: null });
    // Optionally, update Recommendation DB if needed here
    // Notify all subscribers
    const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
    for (const sub of subscribers) {
      try {
        const user = await client.users.fetch(sub.user_id);
        if (user) {
          const embed = await createRecommendationEmbed(metadata);
          await user.send({ content: `Your fic parsing job for <${job.fic_url}> is complete!`, embeds: [embed] });
        }
      } catch (err) {
        console.warn(`[QueueWorker] Failed to DM user ${sub.user_id}:`, err.message);
      }
    }
    // Optionally, clean up subscribers after notification
    await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
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

client.login(process.env.DISCORD_TOKEN);
