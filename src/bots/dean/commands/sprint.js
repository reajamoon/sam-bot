import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { DeanSprints, GuildSprintSettings, User, sequelize } from '../../../models/index.js';
import { startSoloEmbed, hostTeamEmbed, joinTeamEmbed, endSoloEmbed, endTeamEmbed, statusSoloEmbed, statusTeamEmbed, leaveTeamEmbed, listEmbeds, formatListLine } from '../text/sprintText.js';
import { scheduleSprintNotifications } from '../sprintScheduler.js';

export const data = new SlashCommandBuilder()
  .setName('sprint')
  .setDescription('Start or manage a writing sprint')
  .addSubcommand(sub => sub
    .setName('start')
    .setDescription('Start a sprint in this channel')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('host')
    .setDescription('Host a team sprint')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label')))
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join the active team sprint in this channel')
    .addStringOption(opt => opt.setName('code').setDescription('Host code if multiple sprints exist'))
  .addSubcommand(sub => sub
    .setName('end')
    .setDescription('End your active sprint'))
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Show current sprint status'))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the current team sprint')
  )
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List active sprints in this channel'));

  // Admin/mod-only: set default sprint channel for this guild
data.addSubcommand(sub => sub
  .setName('setchannel')
  .setDescription('Set the default channel where sprints run')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to host sprints').setRequired(true))
  .addBooleanOption(opt => opt.setName('allow_threads').setDescription('Allow threads by default (true)'))
);

export async function execute(interaction) {
  const flags = undefined;
  const guildId = interaction.guildId;
  const channel = interaction.channel;
  const channelId = channel ? channel.id : undefined;
  const threadId = (channel && typeof channel.isThread === 'function' && channel.isThread()) ? channel.id : undefined;
  // Defer immediately to avoid "application did not respond" under load
  await interaction.deferReply();

  const settings = await GuildSprintSettings.findOne({ where: { guildId } });
  if (settings) {
    const allowed = Array.isArray(settings.allowedChannelIds) ? settings.allowedChannelIds.includes(channelId) : true;
    const blocked = Array.isArray(settings.blockedChannelIds) && settings.blockedChannelIds.includes(channelId);
    if (blocked || !allowed) {
      return interaction.editReply({ content: 'Sprints are not enabled in this channel.' });
    }
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'start') {
    const minutes = interaction.options.getInteger('minutes');
    const label = interaction.options.getString('label') ?? undefined;

    // Upsert the user row if needed (using discordId)
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Persist the sprint row
    const startedAt = new Date();
    const sprint = await DeanSprints.create({
      userId: discordId,
      guildId,
      channelId,
      threadId,
      type: 'solo',
      visibility,
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
    });

    await interaction.editReply({ embeds: [startSoloEmbed(minutes, label, 'public')] });
    await scheduleSprintNotifications(sprint, interaction.client);
  } else if (sub === 'host') {
    const minutes = interaction.options.getInteger('minutes');
    const label = interaction.options.getString('label') ?? undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Generate a short group code
    const groupId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const startedAt = new Date();
    const hostRow = await DeanSprints.create({
      userId: discordId,
      hostId: discordId,
      groupId,
      role: 'host',
      guildId,
      channelId,
      threadId,
      type: 'team',
      visibility: 'public',
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
    });
    await interaction.editReply({ embeds: [hostTeamEmbed(minutes, label, groupId)] });
    await scheduleSprintNotifications(hostRow, interaction.client);
  } else if (sub === 'join') {
    const codeRaw = interaction.options.getString('code');
    const provided = codeRaw ? codeRaw.toUpperCase() : undefined;
    const discordId = interaction.user.id;
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    let host;
    if (provided) {
      host = await DeanSprints.findOne({ where: { guildId, channelId, status: 'processing', type: 'team', groupId: provided, role: 'host' } });
    } else {
      host = await DeanSprints.findOne({ where: { guildId, channelId, status: 'processing', type: 'team', role: 'host' }, order: [['createdAt', 'DESC']] });
    }
    if (!host) {
      return interaction.editReply({ content: 'No active team sprint found in this channel.' });
    }
    const existing = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (existing) {
      return interaction.editReply({ content: 'You already have an active sprint.' });
    }
    await DeanSprints.create({
      userId: discordId,
      hostId: host.hostId || host.userId,
      groupId: host.groupId,
      role: 'participant',
      guildId,
      channelId,
      threadId,
      type: 'team',
      visibility: host.visibility,
      startedAt: host.startedAt,
      durationMinutes: host.durationMinutes,
      status: 'processing',
      label: host.label,
    });
    await interaction.editReply({ embeds: [joinTeamEmbed()] });
  } else if (sub === 'end') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: 'No active sprint found.' });
    }
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      // End the team (host + all participants)
      await DeanSprints.update({ status: 'done', endNotified: true }, { where: { guildId, groupId: active.groupId, status: 'processing' } });
      await interaction.editReply({ embeds: [endTeamEmbed()] });
    } else {
      await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null });
      await interaction.editReply({ embeds: [endSoloEmbed()] });
    }
  } else if (sub === 'status') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.editReply({ content: 'No active sprint found.' });
    }
    const endsAt = new Date(active.startedAt.getTime() + active.durationMinutes * 60000);
    const remainingMs = endsAt.getTime() - Date.now();
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      const count = await DeanSprints.count({ where: { guildId, groupId: active.groupId, status: 'processing' } });
      await interaction.editReply({ embeds: [statusTeamEmbed(remainingMin, count, active.label)] });
    } else {
      await interaction.editReply({ embeds: [statusSoloEmbed(remainingMin, active.label)] });
    }
  } else if (sub === 'leave') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing', type: 'team' } });
    if (!active) {
      return interaction.editReply({ content: 'You are not in an active team sprint.' });
    }
    if (active.role === 'host') {
      return interaction.editReply({ content: 'Hosts should use /sprint end to end the team sprint.' });
    }
    await active.update({ status: 'done', endNotified: true });
    await interaction.editReply({ embeds: [leaveTeamEmbed()] });
  } else if (sub === 'list') {
    const sprints = await DeanSprints.findAll({ where: { guildId, channelId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    const lines = sprints.map(s => {
      const endsAt = new Date(s.startedAt.getTime() + s.durationMinutes * 60000);
      const remainingMin = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 60000));
      const kind = s.type === 'team' ? (s.role === 'host' ? 'Team host' : 'Team') : 'Solo';
      return formatListLine(kind, remainingMin, s.userId, s.label);
    });
    const embed = listEmbeds(lines);
    await interaction.editReply({ embeds: [embed] });
  } else if (sub === 'setchannel') {
    // Require ManageGuild permission to change settings
    const member = interaction.member;
    const hasPerm = member?.permissions?.has?.('ManageGuild') || member?.permissions?.has?.('Administrator');
    if (!hasPerm) {
      return interaction.editReply({ content: 'You need Manage Server to set the sprint channel.' });
    }
    const target = interaction.options.getChannel('channel');
    const allowThreads = interaction.options.getBoolean('allow_threads') ?? true;
    if (!target) {
      return interaction.editReply({ content: 'Please select a channel.' });
    }
    const allowed = [target.id];
    const payload = {
      allowedChannelIds: allowed,
      allowThreadsByDefault: !!allowThreads,
      defaultSummaryChannelId: target.id,
    };
    const existing = await GuildSprintSettings.findOne({ where: { guildId } });
    if (existing) {
      await existing.update(payload);
    } else {
      await GuildSprintSettings.create({ guildId, ...payload });
    }
    await interaction.editReply({ content: `Sprint channel set to <#${target.id}>. Threads allowed: ${allowThreads ? 'yes' : 'no'}.` });
  }
}
