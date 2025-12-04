import { Config, ModmailRelay } from '../../../../src/models/index.js';

export default async function onMessageCreate(message) {
  try {
    // Only handle DMs from users to Cas
    if (message.author.bot) return;
    const isDM = message.channel.type === 1; /* DM channel in discord.js v14 */

    const client = message.client;
    if (isDM) {
      // Find existing open relay for this user
        // Find existing open relays for this user and prefer Cas-owned threads
        let relay = null;
        const relays = await ModmailRelay.findAll({ where: { user_id: message.author.id, open: true, bot_name: 'cas' } });
        for (const r of relays) {
          const th = client.channels.cache.get(r.thread_id) || (channel && typeof channel.threads?.fetch === 'function' ? await channel.threads.fetch(r.thread_id).catch(() => null) : null) || await client.channels.fetch(r.thread_id).catch(() => null);
          if (th && typeof th.isThread === 'function' && th.isThread()) {
            // Only reuse threads created by Cas
            if (th.ownerId === client.user.id) {
              relay = r;
              break;
            }
          }
        }

    // Resolve modmail channel
    const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
    const modmailChannelId = modmailConfig ? modmailConfig.value : null;
    let channel = modmailChannelId ? client.channels.cache.get(modmailChannelId) : null;
    if (!channel && modmailChannelId) {
      try {
        channel = await client.channels.fetch(modmailChannelId);
      } catch {}
    }
    if (!channel) {
      await message.reply("I don't have modmail configured yet. Please ping a mod.");
      return;
    }

    // If a relay exists, try to use its thread; if it's a Sam-owned thread, do not post into it
    if (relay) {
      const existingThread = client.channels.cache.get(relay.thread_id);
      let ownerMismatch = false;
      if (existingThread && typeof existingThread.isThread === 'function' && existingThread.isThread()) {
        ownerMismatch = existingThread.ownerId && existingThread.ownerId !== client.user.id;
      }
      if (ownerMismatch) {
        // Respect Sam-owned threads: acknowledge and do not recreate/post in main channel
        await message.react('✅');
        await message.reply('I see your message. Your modmail is currently being handled by the other librarian; they\'ll reply in that thread.');
        return;
      }
      if (!existingThread || !(typeof existingThread.isThread === 'function' && existingThread.isThread())) {
        // Missing or invalid thread; allow recreation below
        relay = null;
      }
    }

    if (isDM && !relay) {
      // Create a new modmail thread
      const { EmbedBuilder } = await import('discord.js');
      const baseEmbed = new EmbedBuilder()
        .setColor(0x3b88c3)
        .setAuthor({ name: `Modmail — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content)
        .addFields(
          { name: 'Thread Commands', value: '`@ticket` • show ticket details\n`@relay <message>` • DM the user\n`@close` • close this ticket' }
        )
        .setFooter({ text: `Opened by Cas • User ID: ${message.author.id}` })
        .setTimestamp(new Date());
      const threadName = `ModMail: ${message.author.username}`.substring(0, 100);
      let base = null;
      let thread = null;
      // If modmail channel is a Forum, create a thread directly with the embed
      try {
        const { ChannelType } = await import('discord.js');
        console.log('[cas.modmail] Creating thread. Channel type:', channel.type, 'Forum?', channel.type === ChannelType.GuildForum, 'User:', message.author.id);
        if (channel.type === ChannelType.GuildForum) {
          thread = await channel.threads.create({
            name: threadName,
            autoArchiveDuration: 1440,
            reason: 'User-initiated modmail (DM)',
            message: { embeds: [baseEmbed] }
          });
          console.log('[cas.modmail] Forum thread created:', thread?.id);
        } else {
          const { PermissionFlagsBits, ChannelType } = await import('discord.js');
          const perms = channel.permissionsFor(client.user);
          if (!perms || (!perms.has(PermissionFlagsBits.CreatePublicThreads) && !perms.has(PermissionFlagsBits.CreatePrivateThreads))) {
            base = await channel.send({ embeds: [baseEmbed] });
            await message.reply("I can’t create threads in this channel. Please grant thread permissions or ping a mod.");
            console.warn('[cas.modmail] Missing thread permissions. Base message id:', base?.id);
            return;
          }
          base = await channel.send({ embeds: [baseEmbed] });
          console.log('[cas.modmail] Base message sent. base.id:', base?.id);
          // On regular text channels, start a public thread by default
          thread = await base.startThread({ name: threadName, autoArchiveDuration: 1440, reason: 'User-initiated modmail (DM)' });
          console.log('[cas.modmail] startThread result:', thread?.id, 'isThread?', typeof thread?.isThread === 'function' ? thread.isThread() : null, 'ownerId:', thread?.ownerId);
          if (!thread || !thread.isThread()) {
            await message.reply("I sent the modmail message but couldn’t start the thread. Please ping a mod.");
            console.error('[cas.modmail] startThread failed to return a ThreadChannel. base.id:', base?.id);
            return;
          }
        }
      } catch (e) {
        console.error('[cas.modmail] Exception during thread creation:', e);
        await message.reply("I couldn't start a modmail thread here. Please ping a mod.");
        return;
      }
      // Always post an intro message inside the thread and use its ID as anchor
      try {
        const intro = new EmbedBuilder()
          .setColor(0x3b88c3)
          .setTitle('Modmail Opened')
          .setDescription('Use these to manage this ticket:')
          .addFields(
            { name: 'Show Ticket', value: '`@ticket` or `/ticket`', inline: true },
            { name: 'Relay to User', value: '`@relay <message>`', inline: true },
            { name: 'Close Ticket', value: '`@close` or `/close`', inline: true }
          )
          .setTimestamp(new Date());
        const introMsg = await thread.send({ embeds: [intro] });
        // Use thread intro as base anchor regardless of parent message
        base = base || { id: introMsg.id };
      } catch {}
      // Compute sequential ticket per bot (simple max+1; safe under single process)
      const last = await ModmailRelay.findOne({ where: { bot_name: 'cas' }, order: [['ticket_seq', 'DESC']] });
      const nextSeq = (last && last.ticket_seq ? last.ticket_seq : 0) + 1;
      const ticket = `CAS-${nextSeq}`;
      relay = await ModmailRelay.create({
        user_id: message.author.id,
        bot_name: 'cas',
        ticket_number: ticket,
        ticket_seq: nextSeq,
        fic_url: null,
        base_message_id: base ? base.id : null,
        thread_id: thread.id,
        open: true,
        status: 'open',
        created_at: new Date(),
        last_user_message_at: new Date()
      });
      console.log('[cas.modmail] Relay created:', { user_id: message.author.id, ticket, base_message_id: base ? base.id : null, thread_id: thread?.id });
      await message.reply(`I’ve opened a thread for you. Your ticket is ${ticket}. The moderators will reply shortly.`);
    } else if (isDM) {
      // Post into existing Cas-owned thread
      // Try to resolve thread robustly (cache → fetch → threads.fetch → base message)
      let thread = client.channels.cache.get(relay.thread_id);
      if (!thread && channel && typeof channel.threads?.fetch === 'function') {
        try {
          const fetched = await channel.threads.fetch(relay.thread_id);
          thread = fetched || null;
        } catch {}
      }
      if (!thread) {
        try {
          thread = await client.channels.fetch(relay.thread_id);
        } catch {}
      }
      if (!thread && relay.base_message_id && channel) {
        try {
          const baseMsg = await channel.messages.fetch(relay.base_message_id);
          if (baseMsg && baseMsg.hasThread) {
            thread = baseMsg.thread;
          }
        } catch {}
      }
      if (thread && typeof thread.isThread === 'function' && thread.isThread()) {
        await thread.send({ content: `<@${message.author.id}>: ${message.content}` });
        await relay.update({ last_user_message_at: new Date() });
        await message.react('✅');
      } else {
        // Thread missing; recreate a Cas-owned thread (avoid posting multiple bases)
        const { EmbedBuilder } = await import('discord.js');
        const resumeEmbed = new EmbedBuilder()
          .setColor(0x3b88c3)
          .setAuthor({ name: `Modmail — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
          .setDescription(message.content)
          .addFields(
            { name: 'Thread Commands', value: '`@ticket` • show ticket details\n`@relay <message>` • DM the user\n`@close` • close this ticket' }
          )
          .setFooter({ text: `Resumed by Cas • User ID: ${message.author.id}` })
          .setTimestamp(new Date());
        const { ChannelType, EmbedBuilder } = await import('discord.js');
        const threadName2 = `ModMail: ${message.author.username}`.substring(0, 100);
        let base2 = null;
        let thread2 = null;
        try {
          if (channel.type === ChannelType.GuildForum) {
            thread2 = await channel.threads.create({
              name: threadName2,
              autoArchiveDuration: 1440,
              reason: 'Resume modmail (thread missing)',
              message: { embeds: [resumeEmbed] }
            });
          } else {
            const { PermissionFlagsBits } = await import('discord.js');
            const perms2 = channel.permissionsFor(client.user);
            if (!perms2 || (!perms2.has(PermissionFlagsBits.CreatePublicThreads) && !perms2.has(PermissionFlagsBits.CreatePrivateThreads))) {
              base2 = await channel.send({ embeds: [resumeEmbed] });
              await message.reply("I can’t create threads in this channel. Please grant thread permissions or ping a mod.");
              return;
            }
            base2 = await channel.send({ embeds: [resumeEmbed] });
            thread2 = await base2.startThread({ name: threadName2, autoArchiveDuration: 1440, reason: 'Resume modmail (thread missing)' });
            if (!thread2 || !thread2.isThread()) {
              await message.reply("I sent the modmail message but couldn’t start the thread. Please ping a mod.");
              return;
            }
          }
        } catch (e) {
          await message.reply("I couldn't reopen the modmail thread. Please ping a mod.");
          return;
        }
        // Post an intro in the reopened thread and use it as anchor if needed
        try {
          const intro2 = new EmbedBuilder()
            .setColor(0x3b88c3)
            .setTitle('Modmail Resumed')
            .setDescription('Use these to manage this ticket:')
            .addFields(
              { name: 'Show Ticket', value: '`@ticket` or `/ticket`', inline: true },
              { name: 'Relay to User', value: '`@relay <message>`', inline: true },
              { name: 'Close Ticket', value: '`@close` or `/close`', inline: true }
            )
            .setTimestamp(new Date());
          const introMsg2 = await thread2.send({ embeds: [intro2] });
          await relay.update({ base_message_id: base2 ? base2.id : introMsg2.id, thread_id: thread2.id, last_user_message_at: new Date() });
        } catch {
          await relay.update({ base_message_id: base2 ? base2.id : null, thread_id: thread2.id, last_user_message_at: new Date() });
        }
        await message.reply('Your modmail thread was missing; I’ve reopened it.');
      }
    }

    // End DM handling
    }

    // Handle relay messages from mods inside Cas-owned modmail threads
    if (typeof message.channel.isThread === 'function' && message.channel.isThread()) {
      const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
      const modmailChannelId = modmailConfig ? modmailConfig.value : null;
      const parent = message.channel.parent;
      if (parent && parent.id === modmailChannelId) {
        const content = (message.content || '').trim();
        if (/^(@ticket|\/ticket)/i.test(content)) {
          const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id } });
          if (!relayEntry) {
            await message.reply('No ticket associated with this thread.');
            return;
          }
          const opened = relayEntry.created_at ? new Date(relayEntry.created_at).toLocaleString() : 'unknown';
          const closed = relayEntry.closed_at ? new Date(relayEntry.closed_at).toLocaleString() : '—';
          const { EmbedBuilder } = await import('discord.js');
          const info = new EmbedBuilder()
            .setColor(0x3b88c3)
            .setTitle('Ticket Details')
            .setDescription('Here’s what I’ve got for this ticket:')
            .addFields(
              { name: 'Ticket', value: `${relayEntry.ticket_number || 'N/A'}`, inline: true },
              { name: 'Status', value: `${relayEntry.status || (relayEntry.open ? 'open' : 'closed')}`, inline: true },
              { name: 'Opened', value: `${opened}`, inline: false },
              { name: 'Closed', value: `${closed}`, inline: false },
            )
            .setFooter({ text: 'Cas — Use @relay to DM the user, @close to end.' })
            .setTimestamp(new Date());
          await message.reply({ embeds: [info] });
          return;
        }
        if (/^(@close|\/close)/i.test(content)) {
          const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id, open: true } });
          if (!relayEntry) {
            await message.reply('No open ticket found for this thread.');
            return;
          }
          await ModmailRelay.update({ open: false, status: 'closed', closed_at: new Date() }, { where: { thread_id: message.channel.id } });
          await message.reply('Ticket closed. I won’t relay further messages from the user to this thread.');
          return;
        }
        if (/^(@relay|\/relay)/i.test(content)) {
          const relayMsg = content.replace(/^(@cas\s+relay|@relay|\/relay)/i, '').trim();
          if (!relayMsg) {
            await message.reply('Add a message after `@relay` to DM the user.');
            return;
          }
          // Find relay by this thread
          const relayEntry = await ModmailRelay.findOne({ where: { thread_id: message.channel.id, open: true } });
          if (!relayEntry) {
            await message.reply('I could not find the user for this thread.');
            return;
          }
          try {
            const dmUser = await client.users.fetch(relayEntry.user_id);
            const { EmbedBuilder } = await import('discord.js');
            await dmUser.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x3b88c3)
                  .setDescription(relayMsg)
                  .setFooter({ text: 'Cas — Moderator relay' })
                  .setTimestamp(new Date())
              ]
            });
            await message.reply('I’ve delivered your message.');
            await ModmailRelay.update({ last_relayed_at: new Date() }, { where: { thread_id: message.channel.id } });
          } catch (err) {
            await message.reply("Couldn't DM the user; they may have DMs off.");
          }
        }
      }
    }
  } catch (err) {
    console.error('[cas] messageCreate modmail relay error:', err);
  }
}
