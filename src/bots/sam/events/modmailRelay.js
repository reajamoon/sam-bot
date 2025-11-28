import { Events, ChannelType } from 'discord.js';
import { Config, ParseQueue, ModmailRelay } from '../../../models/index.js';

// Utility: extract fic URL and submitter from the thread's starter message
async function getFicInfoFromThread(thread) {
  try {
    const starterMsg = await thread.fetchStarterMessage();
    if (!starterMsg) return null;
    console.log('[ModmailRelay] Starter message content:', starterMsg.content);
    // Extract fic URL from the message
    const urlMatch = starterMsg.content.match(/https?:\/\/[^\s>]+/);
    if (!urlMatch) return null;
    // Look for user mention in the format <@userId>
    const submitterMatch = starterMsg.content.match(/<@(\d+)>/);
    if (!submitterMatch) return null;
    return {
      ficUrl: urlMatch[0],
      submitterId: submitterMatch[1]
    };
  } catch (err) {
    console.log('[ModmailRelay] Error getting fic info:', err);
    return null;
  }
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    // Don't handle bot messages
    if (message.author.bot) return;
    
    console.log('[ModmailRelay] Message received - Channel type:', message.channel.type, 'Is DM:', message.channel.type === ChannelType.DM, 'Author:', message.author.id);
    
    // Handle DM replies from users back to modmail threads
    if (message.channel.type === ChannelType.DM) { // DM channel
      console.log('[ModmailRelay] DM received from user:', message.author.id, 'Content:', message.content);
      // Find if this user has any active modmail relays
      const relayEntry = await ModmailRelay.findOne({
        where: { user_id: message.author.id },
        order: [['last_relayed_at', 'DESC']]
      });
      if (!relayEntry) {
        console.log('[ModmailRelay] No active relay found for user:', message.author.id);
        return;
      }
      console.log('[ModmailRelay] Found relay entry:', relayEntry.thread_id);
      // Get the modmail thread
      try {
        const thread = await message.client.channels.fetch(relayEntry.thread_id);
        if (!thread || !thread.isThread()) {
          console.log('[ModmailRelay] Thread not found or not a thread:', relayEntry.thread_id);
          return;
        }
        
        // Send the user's reply to the modmail thread
        await thread.send(`**Reply from <@${message.author.id}>:**\n\n${message.content}`);
        console.log('[ModmailRelay] Relayed DM to thread:', thread.id);
        
        // Acknowledge to the user
        await message.react('✅');
        
      } catch (err) {
        console.log('[ModmailRelay] Error relaying DM to thread:', err);
      }
      return;
    }
    
    // Handle messages in modmail threads (mod→user direction)
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
      await message.reply('Dude, you gotta actually tell me what you want me to say to them. Just add your message after `@relay`, or `/relay`.');
      return;
    }
    // DM the submitter
    try {
      const dmUser = await message.client.users.fetch(ficInfo.submitterId);
      if (dmUser) {
        await dmUser.send({
          content: `Hey, the mods wanted me to pass this along about your fic <${ficInfo.ficUrl}>:\n\n"${relayMsg}"\n\nIf you've got questions or want to respond, just reply to this message and I'll make sure they see it.`
        });
        await message.reply('Got it, message delivered.');
        // Store relay mapping in ModmailRelay table
        await ModmailRelay.upsert({
          user_id: ficInfo.submitterId,
          fic_url: ficInfo.ficUrl,
          thread_id: message.channel.id,
          last_relayed_at: new Date()
        });
      }
    } catch (err) {
      await message.reply('Couldn\'t reach them - they probably have DMs turned off.');
    }
  }
};
