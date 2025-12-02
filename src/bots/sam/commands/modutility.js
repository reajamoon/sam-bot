
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Recommendation, ModLock, User, Config, ParseQueue, ParseQueueSubscriber, Series } from '../../../models/index.js';
import { Op } from 'sequelize';

export default {
  data: new SlashCommandBuilder()
    .setName('modutility')
    .setDescription('Moderator utility commands for rec modlocking and admin actions.')
    .addSubcommand(sub =>
      sub.setName('override_validation')
        .setDescription('Approve and requeue a fic flagged as nOTP (Dean/Cas validation fail)')
        .addStringOption(opt =>
          opt.setName('fic_url')
            .setDescription('The AO3 fic or series URL to approve and requeue')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('note')
            .setDescription('Optional note for mods or the submitter (will appear in modmail)')
            .setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('debug_override')
        .setDescription('Admin: check validation override for an AO3 fic or series URL')
        .addStringOption(opt =>
          opt.setName('fic_url')
            .setDescription('The AO3 fic or series URL to check for override')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setmodlock')
        .setDescription('Set a modlock on a recommendation field')
        .addStringOption(opt =>
          opt.setName('rec_id')
            .setDescription('Recommendation ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Field to lock (e.g. title, tags, ALL)')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clearmodlock')
        .setDescription('Clear a modlock on a recommendation field')
        .addStringOption(opt =>
          opt.setName('rec_id')
            .setDescription('Recommendation ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Field to unlock (e.g. title, tags, ALL)')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setgloballocks')
        .setDescription('Set global modlocked fields (superadmin only)')
        .addStringOption(opt =>
          opt.setName('fields')
            .setDescription('Comma-separated list of globally locked fields')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('modmailchannelset')
        .setDescription('Set the modmail channel ID to this channel (superadmin only)')
    ),
  async execute(interaction) {
    // Permission check: Only allow users with at least mod-level permissions
    const userId = interaction.user.id;
    let user = await User.findOne({ where: { discordId: userId } });
    let isMod = false;
    let isSuperadmin = false;
    // Check DB first
    if (user && user.permissionLevel) {
      if (['mod', 'admin', 'superadmin'].includes(user.permissionLevel)) isMod = true;
      if (user.permissionLevel === 'superadmin') isSuperadmin = true;
    }
    // Fallback: check Discord roles if DB not set
    if ((!isMod || !isSuperadmin) && interaction.member && interaction.member.roles) {
      const roles = interaction.member.roles.cache || [];
      if (!isMod && roles.some(r => r.name.toLowerCase().includes('mod') || r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('superadmin'))) {
        isMod = true;
      }
      if (!isSuperadmin && roles.some(r => r.name.toLowerCase().includes('superadmin'))) {
        isSuperadmin = true;
      }
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'override_validation') {
      if (!isMod) {
        return await interaction.reply({ content: 'You need mod permission for this one.', flags: MessageFlags.Ephemeral });
      }
      const ficUrl = interaction.options.getString('fic_url');
      const note = interaction.options.getString('note');
      const isSeries = ficUrl.includes('/series/');
      const noun = isSeries ? 'Series' : 'Fic';
      // Persist a validation override lock immediately so future runs skip validation,
      // even if the fic isn't currently in the queue
      try {
        const workMatch = ficUrl.match(/archiveofourown\.org\/works\/(\d+)/);
        const seriesMatch = ficUrl.match(/archiveofourown\.org\/series\/(\d+)/);
        const lockPayload = {
          field: 'validation_override',
          locked: true,
          lockLevel: 'mod',
          lockedBy: interaction.user.id,
          lockedAt: new Date()
        };
        if (workMatch) lockPayload.ao3ID = String(parseInt(workMatch[1], 10));
        if (!workMatch && seriesMatch) lockPayload.seriesId = parseInt(seriesMatch[1], 10);
        if (lockPayload.ao3ID || lockPayload.seriesId) {
          await ModLock.create(lockPayload);
        }
      } catch (lockErr) {
        console.error('[modutility] Failed to persist validation override lock:', lockErr);
      }
      // Try to find the fic in the queue (nOTP or pending)
      let job = await ParseQueue.findOne({ where: { fic_url: ficUrl } });
      if (!job) {
        return await interaction.reply({ content: `I set the validation override for <${ficUrl}>. Add it to the queue and I’ll skip validation next run.`, flags: MessageFlags.Ephemeral });
      }
      // Only allow override if status is nOTP or error
      if (!['nOTP', 'error'].includes(job.status)) {
        return await interaction.reply({ content: `This ${isSeries ? 'series' : 'fic'} isn’t flagged (current: ${job.status}).`, flags: MessageFlags.Ephemeral });
      }
      // Find the original submitter (requested_by)
      const originalSubmitterId = job.requested_by;
      // Set status to pending, clear validation_reason, and requeue
      await job.update({
        status: 'pending',
        validation_reason: null,
        error_message: null
      });
      // Remove all old subscribers, add the original submitter as subscriber if they want notifications
      await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
      let notifyUser = true;
      let submitter = await User.findOne({ where: { discordId: originalSubmitterId } });
      if (submitter && submitter.queueNotifyTag === false) notifyUser = false;
      if (notifyUser && originalSubmitterId) {
        await ParseQueueSubscriber.create({ queue_id: job.id, user_id: originalSubmitterId });
      }
      // Notify modmail channel
      const modmailConfig = await Config.findOne({ where: { key: 'modmail_channel_id' } });
      const modmailChannelId = modmailConfig ? modmailConfig.value : null;
      if (modmailChannelId) {
        const modmailChannel = interaction.client.channels.cache.get(modmailChannelId);
        if (modmailChannel) {
          let modmailMsg = `✅ Okay, I approved and requeued this ${isSeries ? 'series' : 'fic'} after a mod review: <${ficUrl}>\nSubmitted by: <@${originalSubmitterId}>\nApproved by: <@${interaction.user.id}>`;
          if (note) modmailMsg += `\nNote: ${note}`;
          modmailMsg += `\n> Got questions or want me to relay a note to them? Reply here and I’ll DM them.`;
          // Start a thread for this modmail message
          const threadName = ficUrl.length > 80 ? ficUrl.slice(0, 77) + '...' : ficUrl;
          const modmailMsgObj = await modmailChannel.send({ content: modmailMsg });
          try {
            await modmailMsgObj.startThread({
              name: `Fic: ${threadName}`,
              autoArchiveDuration: 1440 // 24 hours
            });
          } catch (err) {
            // If thread creation fails, just leave the message in channel
          }
        }
      }
      // DM the original submitter
      try {
        if (originalSubmitterId) {
          const dmUser = await interaction.client.users.fetch(originalSubmitterId);
          if (dmUser) {
            await dmUser.send({
              content: `Hey, quick heads up. Your ${isSeries ? 'series' : 'fic'} <${ficUrl}> got a mod thumbs-up, so I put it back in the queue. You’ll get updates as it moves through. Thanks for sticking with it.`
            });
          }
        }
      } catch (err) {
        // Ignore DM errors
      }
      return await interaction.reply({ content: `${noun} <${ficUrl}> approved, override set, and requeued.`, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'debug_override') {
      // Restrict to mods/admins; prefer superadmin but allow mods for quick checks
      if (!isMod) {
        return await interaction.reply({ content: 'You need mod perms for this one.', flags: MessageFlags.Ephemeral });
      }
      const ficUrl = interaction.options.getString('fic_url');
      const workMatch = ficUrl.match(/archiveofourown\.org\/works\/(\d+)/);
      const seriesMatch = ficUrl.match(/archiveofourown\.org\/series\/(\d+)/);
      let workId = workMatch ? parseInt(workMatch[1], 10) : null;
      let seriesId = seriesMatch ? parseInt(seriesMatch[1], 10) : null;
      try {
        const { ModLock, Recommendation, Series } = await import('../../../models/index.js');
        let workOverride = null;
        let seriesOverride = null;
        if (workId) {
          workOverride = await ModLock.findOne({ where: { ao3ID: String(workId), field: 'validation_override', locked: true } });
        }
        if (seriesId) {
          seriesOverride = await ModLock.findOne({ where: { seriesId: seriesId, field: 'validation_override', locked: true } });
        }
        // Also show what the worker will resolve for this URL
        let rec = workId ? await Recommendation.findOne({ where: { ao3ID: workId } }) : null;
        let seriesRec = null;
        if (seriesId) {
          seriesRec = await Series.findOne({ where: { url: { [Op.iLike]: `%/series/${seriesId}%` } } });
        }
        const lines = [];
        lines.push(`URL: <${ficUrl}>`);
        if (workId) lines.push(`Resolved work ao3ID: ${workId}`);
        if (seriesId) lines.push(`Resolved series ao3ID: ${seriesId}`);
        lines.push(`Work override present: ${workOverride ? 'yes' : 'no'}`);
        lines.push(`Series override present: ${seriesOverride ? 'yes' : 'no'}`);
        if (rec) lines.push(`Recommendation exists for work: yes (id=${rec.id})`);
        if (seriesRec) lines.push(`Series exists in DB: yes (id=${seriesRec.id})`);
        await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
      } catch (e) {
        console.error('[modutility] debug_override failed:', e);
        await interaction.reply({ content: 'Debug failed—check logs.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    // Logging for upsert/debug
    if (!user) {
      console.log(`[modutility] User not found in DB, will create: ${userId}`);
    } else if (!user.permissionLevel) {
      console.log(`[modutility] User found but missing permissionLevel, will update: ${userId}`);
    } else {
      console.log(`[modutility] User found with permissionLevel: ${userId} (${user.permissionLevel})`);
    }
    if (sub === 'modmailchannelset') {
      if (!isSuperadmin) {
        return await interaction.reply({ content: 'You need superadmin for this.', flags: MessageFlags.Ephemeral });
      }
      const channelId = interaction.channelId;
      await Config.upsert({ key: 'modmail_channel_id', value: channelId });
      return await interaction.reply({ content: `Set modmail channel to this one (${channelId}).`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'setgloballocks') {
      if (!isSuperadmin) {
        return await interaction.reply({ content: 'You need superadmin for global locks.', flags: MessageFlags.Ephemeral });
      }
      const fields = interaction.options.getString('fields');
      await Config.upsert({ key: 'global_modlocked_fields', value: fields });
      return await interaction.reply({ content: `Global locks set: ${fields}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'setmodlock') {
      const recId = interaction.options.getString('rec_id');
      const field = interaction.options.getString('field');
      const userId = interaction.user.id;
      const rec = await Recommendation.findByPk(recId);
      if (!rec) {
        return await interaction.reply({ content: `I couldn’t find recommendation ID ${recId}.`, flags: MessageFlags.Ephemeral });
      }
      // Upsert user with permissionLevel if not present
      let level = 'mod';
      let user = await User.findOne({ where: { discordId: userId } });
      if (!user) {
        // Try to infer from Discord roles if available, else default to 'mod'
        if (interaction.member && interaction.member.roles) {
          const roles = interaction.member.roles.cache || [];
          if (roles.some(r => r.name.toLowerCase().includes('superadmin'))) level = 'superadmin';
          else if (roles.some(r => r.name.toLowerCase().includes('admin'))) level = 'admin';
        }
        user = await User.create({ discordId: userId, permissionLevel: level });
      } else if (!user.permissionLevel) {
        // Update user if permissionLevel is missing
        if (interaction.member && interaction.member.roles) {
          const roles = interaction.member.roles.cache || [];
          if (roles.some(r => r.name.toLowerCase().includes('superadmin'))) level = 'superadmin';
          else if (roles.some(r => r.name.toLowerCase().includes('admin'))) level = 'admin';
        }
        await user.update({ permissionLevel: level });
      } else {
        if (user.permissionLevel === 'superadmin') level = 'superadmin';
        else if (user.permissionLevel === 'admin') level = 'admin';
        else level = 'mod';
      }
      await ModLock.upsert({
        recommendationId: recId,
        field,
        locked: true,
        lockLevel: level,
        lockedBy: userId,
        lockedAt: new Date(),
        unlockedBy: null,
        unlockedAt: null
      });
      return await interaction.reply({ content: `Locked field "${field}" on rec ID ${recId} at level ${level}.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'clearmodlock') {
      const recId = interaction.options.getString('rec_id');
      const field = interaction.options.getString('field');
      const userId = interaction.user.id;
      const rec = await Recommendation.findByPk(recId);
      if (!rec) {
        return await interaction.reply({ content: `Recommendation ID ${recId} not found.`, flags: MessageFlags.Ephemeral });
      }

      // Find lock using ao3ID or AO3 series ID
      const whereConditions = [];
      if (rec.ao3ID) {
        whereConditions.push({ ao3ID: rec.ao3ID, field, locked: true });
      }
      if (rec.seriesId) {
        // Get the AO3 series ID from the Series table
        const series = await Series.findByPk(rec.seriesId);
        if (series && series.ao3SeriesId) {
          whereConditions.push({ seriesId: series.ao3SeriesId, field, locked: true });
        }
      }

      if (whereConditions.length === 0) {
        return await interaction.reply({ content: `No AO3 ID or series ID found for rec ID ${recId}.`, flags: MessageFlags.Ephemeral });
      }

      const lock = await ModLock.findOne({ where: { [Op.or]: whereConditions } });
      if (!lock) {
        return await interaction.reply({ content: `No active lock found for field "${field}" on rec ID ${recId}.`, flags: MessageFlags.Ephemeral });
      }
      await lock.update({ locked: false, unlockedBy: userId, unlockedAt: new Date() });
      return await interaction.reply({ content: `Unlocked field "${field}" on rec ID ${recId}.`, flags: MessageFlags.Ephemeral });
    }
  },
};
