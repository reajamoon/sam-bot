import { Config, ModmailRelay } from '../../../../src/models/index.js';

export default async function onMessageCreate(message) {
  try {
    // Only handle DMs from users to Cas
    if (message.author.bot) return;
    if (message.channel.type !== 1 /* DM channel in discord.js v14 */) return;

    const client = message.client;
    // Find existing open relay for this user
    let relay = await ModmailRelay.findOne({ where: { user_id: message.author.id, open: true } });

    // Resolve modmail channel
    const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
    const modmailChannelId = modmailConfig ? modmailConfig.value : null;
    const channel = modmailChannelId ? client.channels.cache.get(modmailChannelId) : null;
    if (!channel) {
      await message.reply("I don't have modmail configured yet. Please ping a mod.");
      return;
    }

    // If a relay exists but the thread belongs to another bot (e.g., Sam), ignore it
    if (relay) {
      const existingThread = client.channels.cache.get(relay.thread_id);
      if (existingThread && existingThread.isThread()) {
        // Only reuse threads created by Cas
        if (existingThread.ownerId !== client.user.id) {
          relay = null; // force new thread creation for Cas
        }
      } else {
        // Missing thread; allow recreation below
        relay = null;
      }
    }

    if (!relay) {
      // Create a new modmail thread
      const base = await channel.send({ content: `New modmail from <@${message.author.id}>:\n\n${message.content}` });
      const threadName = `ModMail: ${message.author.username}`.substring(0, 100);
      const thread = await base.startThread({ name: threadName, autoArchiveDuration: 1440, reason: 'User-initiated modmail (DM)' });
      relay = await ModmailRelay.create({
        user_id: message.author.id,
        fic_url: null,
        base_message_id: base.id,
        thread_id: thread.id,
        open: true,
        last_user_message_at: new Date()
      });
      await message.reply('Thanks! I’ve opened a modmail thread and the team will reply shortly.');
    } else {
      // Post into existing Cas-owned thread
      const thread = client.channels.cache.get(relay.thread_id);
      if (thread && thread.isThread()) {
        await thread.send({ content: `<@${message.author.id}>: ${message.content}` });
        await relay.update({ last_user_message_at: new Date() });
        await message.react('✅');
      } else {
        // Thread missing; recreate a Cas-owned thread
        const base = await channel.send({ content: `Modmail resumed for <@${message.author.id}>:\n\n${message.content}` });
        const threadName = `ModMail: ${message.author.username}`.substring(0, 100);
        const thread = await base.startThread({ name: threadName, autoArchiveDuration: 1440, reason: 'Resume modmail (thread missing)' });
        await relay.update({ base_message_id: base.id, thread_id: thread.id, last_user_message_at: new Date() });
        await message.reply('Your modmail thread was missing; I’ve reopened it.');
      }
    }
  } catch (err) {
    console.error('[cas] messageCreate modmail relay error:', err);
  }
}
