import { Events } from 'discord.js';
import { Config, ParseQueue, ModmailRelay } from '../../../models/index.js';

// Utility: extract fic URL and submitter from the thread's starter message
async function getFicInfoFromThread(thread) {
  try {
    const starterMsg = await thread.fetchStarterMessage();
    if (!starterMsg) return null;
    // Look for <ficUrl> and <@userId> in the content
    const urlMatch = starterMsg.content.match(/https?:\/\/[^\s>]+/);
    const submitterMatch = starterMsg.content.match(/Submitted by: <@(\d+)>/);
    if (!urlMatch || !submitterMatch) return null;
    return {
      ficUrl: urlMatch[0],
      submitterId: submitterMatch[1]
    };
  } catch {
    return null;
  }
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    // Only act on messages in threads in the modmail channel, not from bots
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;
    
    console.log('[ModmailRelay] Message in thread detected:', message.channel.name);
    
    // Only handle messages in modmail threads
  console.log('[ModmailRelay] Message received:', message.content, 'in channel:', message.channel.type);
  const parent = message.channel.parent;
    if (!parent) return;
    
    // Check if this is the modmail channel
    const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
    if (!modmailConfig) {
      console.log('[ModmailRelay] No modmail channel configured');
      return;
    }
    
    console.log('[ModmailRelay] Modmail channel configured:', modmailConfig.value, 'Current parent:', parent.id);
    
    if (parent.id !== modmailConfig.value) {
      console.log('[ModmailRelay] Not in modmail channel, ignoring');
      return;
    }
    
    // Don't relay the starter message
    if (message.id === message.channel.id) return;
    
    // Get fic info from thread starter message
    console.log('[ModmailRelay] Getting fic info from thread...');
    const ficInfo = await getFicInfoFromThread(message.channel);
    if (!ficInfo) {
      console.log('[ModmailRelay] Could not extract fic info from thread starter');
      return;
    }
    
    console.log('[ModmailRelay] Found fic info:', ficInfo);
    
    // Relay command: only relay if message starts with @sam relay, @relay, or /relay
    const content = message.content.trim();
    console.log('[ModmailRelay] Message content:', content);
    
    if (!content.toLowerCase().startsWith('@sam relay') && 
        !content.toLowerCase().startsWith('@relay') && 
        !content.toLowerCase().startsWith('/relay')) {
      console.log('[ModmailRelay] Message does not start with relay command');
      return;
    }
    
    console.log('[ModmailRelay] Processing relay command...');
    
    // Remove the command prefix
    const relayMsg = content.replace(/^(@sam relay|@relay|\/relay)/i, '').trim();
    if (!relayMsg) {
      await message.reply('Just let me know what you want to say to the submitter after `@sam relay`, `@relay`, or `/relay`.');
      return;
    }
    // DM the submitter
    try {
      const dmUser = await message.client.users.fetch(ficInfo.submitterId);
      if (dmUser) {
        await dmUser.send({
          content: `Hey, the mods wanted to pass this along about your fic <${ficInfo.ficUrl}>:\n\n"${relayMsg}"\n\nIf you have questions, just reply directly to this message or use /rec help. —Sam`
        });
        await message.reply('Message sent to the submitter.');
        // Store relay mapping in ModmailRelay table
        await ModmailRelay.upsert({
          user_id: ficInfo.submitterId,
          fic_url: ficInfo.ficUrl,
          thread_id: message.channel.id,
          last_relayed_at: new Date()
        });
      }
    } catch (err) {
      await message.reply('Sorry, I couldn’t DM the submitter. They might have DMs off.');
    }
  }
};
