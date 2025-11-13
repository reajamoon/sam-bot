// Optimized: get mention string for subscribers using a user map
function getTagMentions(subscribers, userMap) {
  if (!subscribers.length) return '';
  return subscribers
    .filter(sub => userMap.has(sub.user_id) && userMap.get(sub.user_id).queueNotifyTag !== false)
    .map(sub => `<@${sub.user_id}>`).join(' ');
}

// Periodic cleanup of old queue jobs
async function cleanupOldQueueJobs() {
  const { Op } = require('sequelize');
  const now = new Date();
  // Remove 'done' jobs older than 3 hours
  const doneCutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const doneDeleted = await ParseQueue.destroy({ where: { status: 'done', updated_at: { [Op.lt]: doneCutoff } } });
  if (doneDeleted > 0) {
    console.log(`[QueueWorker] Cleanup: Removed ${doneDeleted} 'done' jobs older than 3 hours.`);
  } else {
    console.log('[QueueWorker] Cleanup: No old done jobs to remove.');
  }

  // Find 'pending' or 'processing' jobs older than 15 minutes
  const stuckCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const stuckJobs = await ParseQueue.findAll({ where: { status: ['pending', 'processing'], updated_at: { [Op.lt]: stuckCutoff } } });
  const errorJobs = await ParseQueue.findAll({ where: { status: 'error' } });
  const allJobs = [...stuckJobs, ...errorJobs];
  if (allJobs.length === 0) return;

  // Batch fetch all subscribers for these jobs
  const allJobIds = allJobs.map(j => j.id);
  const allSubscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: allJobIds } });
  // Batch fetch all users for these subscribers
  const { User } = require('./src/models');
  if (stuckJobs.length > 0) {
    console.log(`[QueueWorker] Cleanup: Found ${stuckJobs.length} stuck 'pending' or 'processing' jobs older than 15 minutes.`);
  } else {
    console.log('[QueueWorker] Cleanup: No stuck pending/processing jobs to remove.');
  }
  for (const job of stuckJobs) {
    // Notify all subscribers (respect queueNotifyTag)
    const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
    const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
    if (configEntry && subscribers.length > 0) {
      const channel = await client.channels.fetch(configEntry.value).catch(() => null);
      if (channel && channel.isTextBased()) {
        const mentions = await getTagMentions(subscribers, User);
        await channel.send({
          content: `${mentions}\nSorry, something went wrong while processing your fic parsing job for <${job.fic_url}>. Please try again.\n\n*Oh and if you want: to toggle queue notifications on|off, you just use the /rec notifytag command.*`,
        });
      }
    }
    await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
    await job.destroy();
    console.log(`[QueueWorker] Cleanup: Dropped stuck job id=${job.id} (status: ${job.status}, url: ${job.fic_url})`);
  }

  // Notify and clean up for each job
  for (const job of allJobs) {
    const subscribers = subsByJob[job.id] || [];
    if (channel && subscribers.length > 0) {
      let content;
      if (job.status === 'error') {
        const mentions = getTagMentions(subscribers, userMap);
        content = `${mentions}\nThere was an error parsing your fic (<${job.fic_url}>): ${job.error_message || 'Unknown error.'}\n\n*So get this, to toggle queue notifications on|off, you just use the /rec notifytag command. Simple as.*`;
      } else {
        const mentions = getTagMentions(subscribers, userMap);
        content = `${mentions}\nSorry, something went wrong while processing your fic parsing job for <${job.fic_url}>. Please try again.\n\n*Oh and if you want: to toggle queue notifications on|off, you just use the /rec notifytag command.*`;
      }
      if (channel.isTextBased()) {
        await channel.send({ content });
      }
    }
  }
  // Bulk destroy all subscribers and jobs
  await ParseQueueSubscriber.destroy({ where: { queue_id: allJobIds } });
  await ParseQueue.destroy({ where: { id: allJobIds } });
}

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
    let userMap = new Map();
    if (firstSub) {
      // Try to get username from User table
      const { User } = require('./src/models');
      const userRecord = await User.findOne({ where: { discordId: firstSub.user_id } });
      user = {
        id: firstSub.user_id,
        username: userRecord ? userRecord.username : `User ${firstSub.user_id}`
      };
      if (userRecord) userMap.set(userRecord.discordId, userRecord);
    }
    let additionalTags = [];
    let notes = '';
    if (job.additional_tags) {
      try { additionalTags = JSON.parse(job.additional_tags); } catch { additionalTags = []; }
    }
    if (job.notes) notes = job.notes;
    const startTime = Date.now();
    // Check for existing recommendation by URL
    let existingRec = await Recommendation.findOne({ where: { url: job.fic_url } });
    const isUpdate = !!existingRec;
    // Fetch config and channel once
    const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
    const channelId = configEntry ? configEntry.value : null;
    let channel = null;
    if (channelId) {
      channel = await client.channels.fetch(channelId).catch(() => null);
    }
    await processRecommendationJob({
      url: job.fic_url,
      user,
      manualFields: {},
      additionalTags,
      notes,
      isUpdate,
      existingRec,
      notify: async (embedOrError) => {
        if (!embedOrError || embedOrError.error) {
          await job.update({ status: 'error', error_message: embedOrError?.error || 'Unknown error' });
          return;
        }
        await job.update({ status: 'done', result: embedOrError.recommendation, error_message: null });
        // Suppress notification if instant_candidate and within threshold
        let thresholdMs = 3000; // default 3 seconds
        const thresholdConfig = await Config.findOne({ where: { key: 'instant_queue_suppress_threshold_ms' } });
        if (thresholdConfig && !isNaN(Number(thresholdConfig.value))) {
          thresholdMs = Number(thresholdConfig.value);
        }
        const elapsed = Date.now() - new Date(job.submitted_at).getTime();
        if (job.instant_candidate && elapsed < thresholdMs) {
          // Clean up subscribers silently
          await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
          return;
        }
        // Notify all subscribers in the configured channel
        const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
        // Batch fetch all users for these subscribers if not already in userMap
        const { User } = require('./src/models');
        const userIds = [...new Set(subscribers.map(sub => sub.user_id))];
        const missingUserIds = userIds.filter(id => !userMap.has(id));
        if (missingUserIds.length > 0) {
          const users = await User.findAll({ where: { discordId: missingUserIds } });
          for (const u of users) userMap.set(u.discordId, u);
        }
        if (!channel || !channel.isTextBased()) {
          console.warn(`[QueueWorker] Could not fetch or use channel ${channelId}. Skipping notification.`);
          return;
        }
        const mentions = getTagMentions(subscribers, userMap);
        await channel.send({
          content: `${mentions}\nYour fic parsing job for <${job.fic_url}> is complete!\n\n*Oh yeah hey, check this out: to toggle queue notifications on|off, you just use the /rec notifytag command. Simple as.*`,
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
        // Simulate 'think time' before starting each job (0.5–2s)
        const thinkTime = 500 + Math.floor(Math.random() * 1500);
        await new Promise(res => setTimeout(res, thinkTime));

        await processQueueJob(job);

        // Vary delay range (12–20s normal, 20–30s rare)
        // Use a weighted random: 75% chance 12–20s, 25% chance 20–30s
        let delayMs;
        const r = Math.random();
        if (r < 0.75) {
          delayMs = 12000 + Math.floor(Math.random() * 8000); // 12–20s
        } else {
          delayMs = 20000 + Math.floor(Math.random() * 10000); // 20–30s
        }

        // Rare long pause: every 10–20 jobs, pause 1–3 min
        pollQueue.jobCount = (pollQueue.jobCount || 0) + 1;
        if (pollQueue.jobCount % (10 + Math.floor(Math.random() * 11)) === 0) {
          const longPause = 60000 + Math.floor(Math.random() * 120000); // 1–3 min
          console.log(`[QueueWorker] Taking a long pause for ${Math.round(longPause/1000)} seconds to mimic human behavior.`);
          await new Promise(res => setTimeout(res, longPause));
        } else {
          await new Promise(res => setTimeout(res, delayMs));
        }
      } else {
        // No pending jobs, wait before polling again (randomize 4–7s)
        const idleDelay = 4000 + Math.floor(Math.random() * 3000);
        await new Promise(res => setTimeout(res, idleDelay));
      }
    } catch (err) {
      console.error('[QueueWorker] Polling error:', err);
      await new Promise(res => setTimeout(res, 10000));
    }
  }
}



client.once('ready', () => {
  const now = new Date();
  console.log(`[QueueWorker] Discord client ready. Starting queue polling... (${now.toISOString()})`);
  pollQueue();
  // Run cleanup every 15 minutes
  setInterval(() => {
    console.log('[QueueWorker] Running scheduled cleanup of old queue jobs...');
    cleanupOldQueueJobs();
  }, 15 * 60 * 1000);
  // Also run once at startup
  console.log('[QueueWorker] Running initial cleanup of old queue jobs...');
  cleanupOldQueueJobs();
});

client.login(process.env.BOT_TOKEN);
