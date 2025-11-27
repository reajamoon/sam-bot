import { Events } from 'discord.js';
import { Config, ModmailRelay } from '../../../models/index.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    // Only handle DMs to the bot
    if (message.channel.type !== 1) return; // 1 = DM
    if (message.author.bot) return;
    // If this is a reply, try to extract ficUrl from the replied-to message
    let ficUrl = null;
    if (message.reference && message.reference.messageId) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        const urlMatch = repliedMsg.content.match(/https?:\/\/[^\s>]+/);
        if (urlMatch) ficUrl = urlMatch[0];
      } catch {}
    }
    // If not a reply, optionally try to parse ficUrl from message content (fallback)
    if (!ficUrl) {
      const urlMatch = message.content.match(/https?:\/\/[^\s>]+/);
      if (urlMatch) ficUrl = urlMatch[0];
    }
    if (!ficUrl) return; // Can't route without ficUrl
    // Find the threadId for this user+ficUrl in ModmailRelay table
    const relay = await ModmailRelay.findOne({ where: { user_id: message.author.id, fic_url: ficUrl } });
    if (!relay) return;
    const threadId = relay.thread_id;
    // Fetch the thread and relay the message
    try {
      const client = message.client;
      const thread = await client.channels.fetch(threadId);
      if (!thread || !thread.isThread()) return;
      await thread.send({
        content: `Hey mods, the submitter (<@${message.author.id}>) replied about <${ficUrl}>:\n\n"${message.content}"\n\nIf you want to respond, reply to this message with @sam relay or /relay.`
      });
      // Update last_relayed_at
      await relay.update({ last_relayed_at: new Date() });
    } catch (err) {
      await message.reply('Hmm... I couldn\’t find the mods. It\'s probably crypto\'s fault.\nTry sending a new modmail on PB, use `/ModMail` and Cas will be able to track them down for you.');
    }
  }
};
