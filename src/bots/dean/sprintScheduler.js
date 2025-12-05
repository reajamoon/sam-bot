import { midpointEmbed, completeEmbed, summaryEmbed } from './text/sprintText.js';
import { DeanSprints, GuildSprintSettings } from '../../models/index.js';

function getChannelFromIds(client, guildId, channelId, threadId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return null;
  if (threadId && channel.threads) {
    const thread = channel.threads.cache.get(threadId);
    return thread || channel;
  }
  return channel;
}

export async function scheduleSprintNotifications(sprint, client) {
  const durationMs = (sprint.durationMinutes || 0) * 60000;
  if (!durationMs) return;

  const startedAtMs = new Date(sprint.startedAt).getTime();
  const now = Date.now();
  const midpointDelay = Math.max(0, startedAtMs + durationMs / 2 - now);
  const endDelay = Math.max(0, startedAtMs + durationMs - now);

  const targetChannel = getChannelFromIds(client, sprint.guildId, sprint.channelId, sprint.threadId);
  if (!targetChannel) return;

  // Midpoint notification
  if (!sprint.midpointNotified) {
    setTimeout(async () => {
      try {
        const fresh = await DeanSprints.findByPk(sprint.id);
        if (!fresh || fresh.status !== 'processing') return;
        const embed = midpointEmbed(fresh.label);
        await targetChannel.send({ embeds: [embed] });
        await fresh.update({ midpointNotified: true });
      } catch (e) {
        console.warn('[dean] midpoint notify failed', e?.message || e);
      }
    }, midpointDelay);
  }

  // End notification
  setTimeout(async () => {
    try {
      const fresh = await DeanSprints.findByPk(sprint.id);
      if (!fresh || fresh.status !== 'processing') return;
      const embed = completeEmbed(fresh.type === 'team', fresh.label);
      // Only host posts completion for team to avoid duplicates
      if (fresh.type === 'team' && fresh.role !== 'host') {
        await fresh.update({ status: 'done', endNotified: true });
        return;
      }
      await targetChannel.send({ embeds: [embed] });
      // Mark all team rows done if host, otherwise just the solo
      if (fresh.type === 'team' && fresh.groupId) {
        await DeanSprints.update({ status: 'done', endNotified: true }, { where: { guildId: fresh.guildId, groupId: fresh.groupId, status: 'processing' } });
      } else {
        await fresh.update({ status: 'done', endNotified: true });
      }

      // Optional summary posting
      const settings = await GuildSprintSettings.findOne({ where: { guildId: fresh.guildId } });
      if (settings?.defaultSummaryChannelId) {
        const summaryChannel = getChannelFromIds(client, fresh.guildId, settings.defaultSummaryChannelId);
        if (summaryChannel) {
          const sum = await buildSummaryForSprintGroup(fresh);
          const sumEmbed = summaryEmbed(sum);
          await summaryChannel.send({ embeds: [sumEmbed] });
        }
      }
    } catch (e) {
      console.warn('[dean] end notify failed', e?.message || e);
    }
  }, endDelay);
}

async function buildSummaryForSprintGroup(sprint) {
  if (sprint.type === 'team' && sprint.groupId) {
    const rows = await DeanSprints.findAll({ where: { guildId: sprint.guildId, groupId: sprint.groupId }, order: [['createdAt', 'ASC']] });
    return {
      type: 'team',
      label: sprint.label,
      durationMinutes: sprint.durationMinutes,
      count: rows.length,
      participants: rows.map(r => ({ userId: r.userId, role: r.role })),
    };
  }
  return {
    type: 'solo',
    label: sprint.label,
    durationMinutes: sprint.durationMinutes,
    count: 1,
    participants: [{ userId: sprint.userId, role: 'solo' }],
  };
}
import { setTimeout as delay } from 'timers/promises';
import { DeanSprints, GuildSprintSettings } from '../../models/index.js';
import { midpointEmbed, completeEmbed, summaryEmbed } from './text/sprintText.js';

export async function startSprintWatchdog(client) {
  // Lightweight poller to send end notifications; midpoint can be added similarly
  async function tick() {
    const now = Date.now();
    const active = await DeanSprints.findAll({ where: { status: 'processing' }, limit: 100 });
    for (const s of active) {
      const endsAt = new Date(s.startedAt).getTime() + s.durationMinutes * 60000;
      const midpointAt = new Date(s.startedAt).getTime() + Math.floor(s.durationMinutes / 2) * 60000;
      try {
        // For team sprints, only host triggers channel notifications
        const isTeamHost = s.type === 'team' && s.role === 'host';
        const shouldNotify = s.type === 'solo' || isTeamHost;
        if (shouldNotify && !s.midpointNotified && now >= midpointAt && s.durationMinutes >= 2) {
          await notify(client, s, { embeds: [midpointEmbed()] });
          await s.update({ midpointNotified: true });
        }
        if (!s.endNotified && now >= endsAt) {
          if (shouldNotify) {
            await notify(client, s, { embeds: [completeEmbed()] });
            // Also send to summary channel if configured
            const settings = await GuildSprintSettings.findOne({ where: { guildId: s.guildId } });
            if (settings?.defaultSummaryChannelId) {
              await notifySummary(client, s, settings.defaultSummaryChannelId);
            }
          }
          await s.update({ endNotified: true, status: 'done' });
        }
      } catch (e) {
        // Continue processing other sprints
        console.error('[dean] sprintScheduler notify error', e);
      }
    }
  }

  async function notify(client, s, payload) {
    const channel = await client.channels.fetch(s.threadId || s.channelId).catch(() => null);
    if (!channel) return;
    await channel.send(payload);
  }

  async function notifySummary(client, s, summaryChannelId) {
    const channel = await client.channels.fetch(summaryChannelId).catch(() => null);
    if (!channel) return;
    const isTeam = s.type === 'team';
    const embed = summaryEmbed(`<#${s.threadId || s.channelId}>`, s.label, isTeam);
    await channel.send({ embeds: [embed] });
  }

  (async function loop() {
    // Poll every 30s; AO3 rate limit spacing in Jack is ~20s, so this is fine
    while (true) {
      await tick();
      await delay(30000);
    }
  })();
}
