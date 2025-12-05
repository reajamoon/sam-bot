import { initEmojiStore } from '../../../shared/emojiStore.js';
import { DeanSprints } from '../../../models/index.js';
import { scheduleSprintNotifications, startSprintWatchdog } from '../sprintScheduler.js';

export default function onReady(client) {
  client.once('ready', async () => {
    console.log(`[dean] Logged in as ${client.user.tag}`);

    // Initialize shared emoji store
    const ok = await initEmojiStore(client).catch(() => false);
    if (!ok) {
      console.warn('[dean] Emoji store did not initialize. Check guild ID env (DEAN_GUILD_ID or GUILD_ID).');
    }

    // Set presence so Dean's activity shows in Discord
    try {
      const activityName = (process.env.DEAN_ACTIVITY_NAME && process.env.DEAN_ACTIVITY_NAME.trim()) || '⏱️ Running sprints';
      const status = (process.env.DEAN_STATUS && process.env.DEAN_STATUS.trim()) || 'online';
      await client.user.setPresence({
        status,
        activities: [
          {
            name: activityName,
            type: 3,
            timestamps: { start: Date.now() },
          },
        ],
      });
      console.log('[dean] Presence set:', activityName);
    } catch (err) {
      console.warn('[dean] Failed to set activity presence:', (err && err.message) || err);
    }

    // Re-schedule any in-progress sprints after a restart
    try {
      const rows = await DeanSprints.findAll({ where: { status: 'processing' } });
      for (const sprint of rows) {
        scheduleSprintNotifications(sprint, client);
      }
      if (rows.length) {
        console.log(`[dean] Re-scheduled ${rows.length} in-progress sprints.`);
      }
    } catch (e) {
      console.warn('[dean] Failed to reschedule sprints on boot:', (e && e.message) || e);
    }

    // Start sprint watchdog now that the client is ready
    try {
      startSprintWatchdog(client);
    } catch (e) {
      console.warn('[dean] Failed to start sprint watchdog:', (e && e.message) || e);
    }
  });
}
