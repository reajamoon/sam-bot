import { Events, ChannelType } from 'discord.js';
import { User, Config, ParseQueue, ModmailRelay } from '../../../models/index.js';

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
        // Don't track bot messages
        if (message.author.bot) return;
        
        console.log('[MessageCreate] Message received - Channel type:', message.channel.type, 'Is DM:', message.channel.type === ChannelType.DM, 'Author:', message.author.id);
        
        // Handle DM replies from users back to modmail threads
        if (message.channel.type === ChannelType.DM) {
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
        
        // Handle modmail thread relay commands (@relay, @sam relay, /relay)
        if (message.channel.isThread()) {
            console.log('[ModmailRelay] Message in thread detected:', message.channel.name);
            
            const parent = message.channel.parent;
            if (!parent) return;
            
            // Check if this is the modmail channel
            const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
            if (!modmailConfig) {
                console.log('[ModmailRelay] No modmail channel configured');
                // Continue to message tracking
            } else if (parent.id === modmailConfig.value) {
                // Don't relay the starter message
                if (message.id === message.channel.id) {
                    // Continue to message tracking
                } else {
                    // Check for relay commands
                    const content = message.content.trim();
                    console.log('[ModmailRelay] Message content:', content);
                    
                    if (content.toLowerCase().startsWith('@sam relay') || 
                        content.toLowerCase().startsWith('@relay') || 
                        content.toLowerCase().startsWith('/relay')) {
                        
                        console.log('[ModmailRelay] Processing relay command...');
                        
                        // Get fic info from thread starter message
                        const ficInfo = await getFicInfoFromThread(message.channel);
                        if (!ficInfo) {
                            console.log('[ModmailRelay] Could not extract fic info from thread starter');
                            return; // Stop processing if can't get fic info
                        } else {
                            console.log('[ModmailRelay] Found fic info:', ficInfo);
                            
                            // Remove the command prefix
                            const relayMsg = content.replace(/^(@sam relay|@relay|\/relay)/i, '').trim();
                            if (!relayMsg) {
                                await message.reply('Dude, you gotta actually tell me what you want me to say to them. Just add your message after `@sam relay`, `@relay`, or `/relay`.');
                                return;
                            }
                            
                            // DM the submitter
                            try {
                                const dmUser = await message.client.users.fetch(ficInfo.submitterId);
                                if (dmUser) {
                                    await dmUser.send({
                                        content: `Hey, the mods wanted me to pass this along about your fic <${ficInfo.ficUrl}>:\n\n"${relayMsg}"\n\nIf you've got questions or want to respond, just reply to this message and I'll make sure they see it. —Sam`
                                    });
                                    await message.reply('Got it—message delivered.');
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
                            return; // Don't track relay command messages
                        }
                    } else {
                        console.log('[ModmailRelay] Message does not start with relay command');
                        return; // Don't track modmail thread messages that aren't relay commands
                    }
                }
            }
        }
        
        try {
            // Find or create user in database
            const [user, created] = await User.findOrCreate({
                where: { discordId: message.author.id },
                defaults: {
                    discordId: message.author.id,
                    username: message.author.username,
                    discriminator: message.author.discriminator || '0',
                    avatar: message.author.avatar,
                    messageCount: 1,
                    messageCountStartDate: new Date(), // Set when first message is tracked
                    lastSeen: new Date()
                }
            });

            if (!created) {
                // Update existing user
                const updateData = {
                    username: message.author.username,
                    discriminator: message.author.discriminator || '0',
                    avatar: message.author.avatar,
                    lastSeen: new Date()
                };
                // If this user doesn't have a messageCountStartDate yet, set it now (backward compatibility)
                if (!user.messageCountStartDate) {
                    updateData.messageCountStartDate = new Date();
                }
                // If admin has set the message count before
                if (user.messageCountSetAt) {
                    updateData.messageCount = user.messageCount + 1;
                    updateData.messagesSinceAdminSet = (user.messagesSinceAdminSet || 0) + 1;
                } else {
                    updateData.messageCount = user.messageCount + 1;
                }
                await user.update(updateData);
                // Add experience points (optional - for future leveling system)
                // You can enable this later when you implement leveling
                // const leveledUp = user.addExperience(Math.floor(Math.random() * 15) + 10);
                // await user.save();
                // if (leveledUp) {
                //     // Could send a level up message here
                //     console.log(`${message.author.username} leveled up to ${user.level}!`);
                // }
            }

        } catch (error) {
            console.error('Error tracking message:', error);
        }
    }
};