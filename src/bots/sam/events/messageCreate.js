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
                where: { user_id: message.author.id, bot_name: 'sam', open: true },
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
                // Only handle commands in threads owned by Sam
                if (message.channel.ownerId !== message.client.user.id) {
                    return;
                }
                // Don't relay the starter message
                if (message.id === message.channel.id) {
                    // Continue to message tracking
                } else {
                    // Check for relay commands
                    const content = message.content.trim();
                    console.log('[ModmailRelay] Message content:', content);
                    
                    if (content.toLowerCase().startsWith('@ticket') || content.toLowerCase().startsWith('/ticket')) {
                        const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id } });
                        if (!relayEntry) {
                            await message.reply('No ticket associated with this thread.');
                        } else {
                            const opened = relayEntry.created_at ? new Date(relayEntry.created_at).toLocaleString() : 'unknown';
                            const closed = relayEntry.closed_at ? new Date(relayEntry.closed_at).toLocaleString() : '—';
                            const { EmbedBuilder } = await import('discord.js');
                            const info = new EmbedBuilder()
                              .setColor(0x3b88c3)
                              .setTitle('Ticket Details')
                              .setDescription("Here's the ticket info—keep it tidy:")
                              .addFields(
                                { name: 'Ticket', value: `${relayEntry.ticket_number || 'N/A'}`, inline: true },
                                { name: 'Status', value: `${relayEntry.status || (relayEntry.open ? 'open' : 'closed')}`, inline: true },
                                { name: 'Opened', value: `${opened}`, inline: false },
                                { name: 'Closed', value: `${closed}`, inline: false },
                              )
                              .setFooter({ text: 'Sam — @relay to DM, @close to finish.' })
                              .setTimestamp(new Date());
                            await message.reply({ embeds: [info] });
                        }
                        return;
                    }
                    if (content.toLowerCase().startsWith('@close') || content.toLowerCase().startsWith('/close')) {
                        const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id, open: true } });
                        if (!relayEntry) {
                            await message.reply('No open ticket found for this thread.');
                        } else {
                            await ModmailRelay.update({ open: false, status: 'closed', closed_at: new Date() }, { where: { thread_id: message.channel.id } });
                            await message.reply('Ticket closed. I won’t relay further messages from the user to this thread.');
                        }
                        return;
                    }
                    if (content.toLowerCase().startsWith('@relay') || 
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
                            const relayMsg = content.replace(/^(@relay|\/relay)/i, '').trim();
                            if (!relayMsg) {
                                await message.reply('Dude, you gotta actually tell me what you want me to say to them. Just add your message after `@relay` or `/relay`.');
                                return;
                            }
                            
                            // DM the submitter
                            try {
                                const dmUser = await message.client.users.fetch(ficInfo.submitterId);
                                if (dmUser) {
                                    await dmUser.send({
                                        content: `Heads up about your fic <${ficInfo.ficUrl}>:\n\n"${relayMsg}"\n\nHit me back here with any questions—I'll make sure the mods see it. —Sam`
                                    });
                                    await message.reply('Got it—message delivered.');
                                    // Store relay mapping in ModmailRelay table
                                    // Compute sequential ticket for Sam
                                    const last = await ModmailRelay.findOne({ where: { bot_name: 'sam' }, order: [['ticket_seq', 'DESC']] });
                                    const nextSeq = (last && last.ticket_seq ? last.ticket_seq : 0) + 1;
                                    const ticket = `SAM-${nextSeq}`;
                                                                        await ModmailRelay.upsert({
                                        user_id: ficInfo.submitterId,
                                        bot_name: 'sam',
                                        ticket_number: ticket,
                                        ticket_seq: nextSeq,
                                        fic_url: ficInfo.ficUrl,
                                        thread_id: message.channel.id,
                                        open: true,
                                        status: 'open',
                                        created_at: new Date(),
                                        last_relayed_at: new Date()
                                    });
                                                                        // Post helper embed with thread commands for mods' convenience
                                                                        const { EmbedBuilder } = await import('discord.js');
                                                                        const help = new EmbedBuilder()
                                                                            .setColor(0x3b88c3)
                                                                            .setTitle('Thread Commands')
                                                                            .setDescription('Use these to manage the ticket:')
                                                                            .addFields(
                                                                                { name: 'Show Ticket', value: '`@ticket` or `/ticket`', inline: true },
                                                                                { name: 'Relay to User', value: '`@relay <message>`', inline: true },
                                                                                { name: 'Close Ticket', value: '`@close` or `/close`', inline: true },
                                                                            )
                                                                            .setFooter({ text: `Ticket ${ticket}` })
                                                                            .setTimestamp(new Date());
                                                                        await message.channel.send({ embeds: [help] });
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