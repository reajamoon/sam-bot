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
    .addStringOption(opt => opt.setName('label').setDescription('Optional label'))
    .addBooleanOption(opt => opt.setName('ephemeral').setDescription('Respond privately (default is public)'))
    .addStringOption(opt => opt.setName('visibility').setDescription('public or private').addChoices(
      { name: 'public', value: 'public' },
      { name: 'private', value: 'private' }
    )))
  .addSubcommand(sub => sub
    .setName('host')
    .setDescription('Host a team sprint')
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('label').setDescription('Optional label'))
    .addBooleanOption(opt => opt.setName('ephemeral').setDescription('Respond privately (default is public)'))
    .addStringOption(opt => opt.setName('visibility').setDescription('public or private').addChoices(
      { name: 'public', value: 'public' },
      { name: 'private', value: 'private' }
    )))
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join the active team sprint in this channel')
    .addStringOption(opt => opt.setName('code').setDescription('Host code if multiple sprints exist'))
    .addBooleanOption(opt => opt.setName('ephemeral').setDescription('Respond privately (default is public)')))
  .addSubcommand(sub => sub
    .setName('end')
    .setDescription('End your active sprint'))
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Show current sprint status'))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the current team sprint')
    .addBooleanOption(opt => opt.setName('ephemeral').setDescription('Respond privately (default is public)')))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List active sprints in this channel')
    .addBooleanOption(opt => opt.setName('ephemeral').setDescription('Respond privately (default is public)')));

  // Admin/mod-only: set default sprint channel for this guild
data.addSubcommand(sub => sub
  .setName('setchannel')
  .setDescription('Set the default channel where sprints run')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to host sprints').setRequired(true))
  .addBooleanOption(opt => opt.setName('allow_threads').setDescription('Allow threads by default (true)'))
);

export async function execute(interaction) {
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
  const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
  const guildId = interaction.guildId;
  const channel = interaction.channel;
  const channelId = channel ? channel.id : undefined;
  const threadId = (channel && typeof channel.isThread === 'function' && channel.isThread()) ? channel.id : undefined;

  const settings = await GuildSprintSettings.findOne({ where: { guildId } });
  if (settings) {
    const allowed = Array.isArray(settings.allowedChannelIds) ? settings.allowedChannelIds.includes(channelId) : true;
    const blocked = Array.isArray(settings.blockedChannelIds) && settings.blockedChannelIds.includes(channelId);
    if (blocked || !allowed) {
      return interaction.reply({ content: 'Sprints are not enabled in this channel.', flags });
    }
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'start') {
    const minutes = interaction.options.getInteger('minutes');
    const label = interaction.options.getString('label') ?? undefined;
    const visibility = interaction.options.getString('visibility') ?? 'public';

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

    await interaction.reply({ embeds: [startSoloEmbed(minutes, label, visibility)], flags });
    await scheduleSprintNotifications(sprint, interaction.client);
  } else if (sub === 'host') {
    const minutes = interaction.options.getInteger('minutes');
    const label = interaction.options.getString('label') ?? undefined;
    const visibility = interaction.options.getString('visibility') ?? 'public';
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
      visibility,
      startedAt,
      durationMinutes: minutes,
      status: 'processing',
      label,
    });
    await interaction.reply({ embeds: [hostTeamEmbed(minutes, label, groupId)], flags });
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
      return interaction.reply({ content: 'No active team sprint found in this channel.', flags });
    }
    const existing = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (existing) {
      return interaction.reply({ content: 'You already have an active sprint.', flags });
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
    await interaction.reply({ embeds: [joinTeamEmbed()], flags });
  } else if (sub === 'end') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.reply({ content: 'No active sprint found.', flags });
    }
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      // End the team (host + all participants)
      await DeanSprints.update({ status: 'done', endNotified: true }, { where: { guildId, groupId: active.groupId, status: 'processing' } });
      await interaction.reply({ embeds: [endTeamEmbed()], flags });
    } else {
      await active.update({ status: 'done', endNotified: true, wordcountEnd: active.wordcountEnd ?? null });
      await interaction.reply({ embeds: [endSoloEmbed()], flags });
    }
  } else if (sub === 'status') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
    if (!active) {
      return interaction.reply({ content: 'No active sprint found.', flags });
    }
    const endsAt = new Date(active.startedAt.getTime() + active.durationMinutes * 60000);
    const remainingMs = endsAt.getTime() - Date.now();
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
    if (active.type === 'team' && active.role === 'host' && active.groupId) {
      const count = await DeanSprints.count({ where: { guildId, groupId: active.groupId, status: 'processing' } });
      await interaction.reply({ embeds: [statusTeamEmbed(remainingMin, count, active.label)], flags });
    } else {
      await interaction.reply({ embeds: [statusSoloEmbed(remainingMin, active.label)], flags });
    }
  } else if (sub === 'leave') {
    const discordId = interaction.user.id;
    const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing', type: 'team' } });
    if (!active) {
      return interaction.reply({ content: 'You are not in an active team sprint.', flags });
    }
    if (active.role === 'host') {
      return interaction.reply({ content: 'Hosts should use /sprint end to end the team sprint.', flags });
    }
    await active.update({ status: 'done', endNotified: true });
    await interaction.reply({ embeds: [leaveTeamEmbed()], flags });
  } else if (sub === 'list') {
    const ephem = interaction.options.getBoolean('ephemeral') ?? false;
    const listFlags = ephem ? MessageFlags.Ephemeral : undefined;
    const sprints = await DeanSprints.findAll({ where: { guildId, channelId, status: 'processing' }, order: [['startedAt', 'DESC']] });
    const lines = sprints.map(s => {
      const endsAt = new Date(s.startedAt.getTime() + s.durationMinutes * 60000);
      const remainingMin = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 60000));
      const kind = s.type === 'team' ? (s.role === 'host' ? 'Team host' : 'Team') : 'Solo';
      return formatListLine(kind, remainingMin, s.userId, s.label);
    });
    const embed = listEmbeds(lines);
    await interaction.reply({ embeds: [embed], flags: listFlags });
  } else if (sub === 'setchannel') {
    // Require ManageGuild permission to change settings
    const member = interaction.member;
    const hasPerm = member?.permissions?.has?.('ManageGuild') || member?.permissions?.has?.('Administrator');
    if (!hasPerm) {
      return interaction.reply({ content: 'You need Manage Server to set the sprint channel.', flags });
    }
    const target = interaction.options.getChannel('channel');
    const allowThreads = interaction.options.getBoolean('allow_threads') ?? true;
    if (!target) {
      return interaction.reply({ content: 'Please select a channel.', flags });
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
    await interaction.reply({ content: `Sprint channel set to <#${target.id}>. Threads allowed: ${allowThreads ? 'yes' : 'no'}.`, flags });
  }
}
