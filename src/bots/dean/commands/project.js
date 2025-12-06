import { SlashCommandBuilder } from 'discord.js';
import { Op } from 'sequelize';
import { DeanSprints, GuildSprintSettings, User, Project, ProjectMember, Wordcount } from '../../../models/index.js';

export const data = new SlashCommandBuilder()
  .setName('project')
  .setDescription('Manage writing projects and collaborators')
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Create a new project')
    .addStringOption(opt => opt.setName('name').setDescription('Project name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('info')
    .setDescription('Show details and recent totals for a project')
    .addStringOption(opt => opt.setName('project').setDescription('Project ID or Name').setRequired(false)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List your projects'))
  .addSubcommand(sub => sub
    .setName('invite')
    .setDescription('Invite a member to your project')
    .addUserOption(opt => opt.setName('member').setDescription('User to invite').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a member from your project')
    .addUserOption(opt => opt.setName('member').setDescription('User to remove').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm removal')))
  .addSubcommand(sub => sub
    .setName('transfer')
    .setDescription('Transfer project ownership to a member')
    .addUserOption(opt => opt.setName('member').setDescription('New owner').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm transfer')))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the current project')
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm leave')))
  .addSubcommand(sub => sub
    .setName('use')
    .setDescription('Use a project for your active sprint')
    .addStringOption(opt => opt.setName('project').setDescription('Project ID or Name').setRequired(true)))
  .addSubcommand(sub => sub
    .setName('members')
    .setDescription('List project members'))
  .addSubcommandGroup(group => group
    .setName('wc')
    .setDescription('Manage a project wordcount directly')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add words directly to a project (outside a sprint)')
      .addIntegerOption(opt => opt.setName('new-words').setDescription('Words added (positive)').setRequired(true))
      .addStringOption(opt => opt.setName('project').setDescription('Project ID or Name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set your current wordcount for a project (outside a sprint)')
      .addIntegerOption(opt => opt.setName('count').setDescription('Current wordcount').setRequired(true))
      .addStringOption(opt => opt.setName('project').setDescription('Project ID or Name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('show')
      .setDescription('Show your current project wordcount (outside a sprint)')
      .addStringOption(opt => opt.setName('project').setDescription('Project ID or Name').setRequired(true)))
  )

export async function execute(interaction) {
  try {
    const guildId = interaction.guildId;
    const subName = interaction.options.getSubcommand();
    const subGroup = interaction.options.getSubcommandGroup(false);
    const discordId = interaction.user.id;

    // Ensure user row exists
    await User.findOrCreate({ where: { discordId }, defaults: { username: interaction.user.username } });

    // Default defer to avoid timeouts; make sensitive prompts ephemeral
    const wantsConfirmEphemeral = ['remove', 'transfer', 'leave'].includes(subName) && !(interaction.options.getBoolean('confirm') ?? false);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: wantsConfirmEphemeral });
    }

    if (subName === 'create') {
      const name = interaction.options.getString('name');
      const project = await Project.create({ ownerId: discordId, name });
      await ProjectMember.create({ projectId: project.id, userId: discordId, role: 'owner' });
      return interaction.editReply({ content: `Project **${name}** created. ID: ${project.id}` });
    }

    if (subName === 'info') {
      const projectInput = interaction.options.getString('project');
      // If no argument, return all projects owned or joined by user
      if (!projectInput) {
        // Get all owned projects
        const ownedProjects = await Project.findAll({ where: { ownerId: discordId } });
        // Get all joined projects (excluding owned)
        const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }] });
        const joinedProjects = memberships.map(m => m.Project).filter(p => p && p.ownerId !== discordId);
        const allProjects = [...ownedProjects, ...joinedProjects];
        if (allProjects.length === 0) {
          return interaction.editReply({ content: "You don't have any projects yet. Try `/project create`." });
        }
        // Build a summary embed listing all projects
        const Discord = await import('discord.js');
        const { EmbedBuilder } = Discord;
        const embed = new EmbedBuilder()
          .setTitle('Your Projects')
          .setDescription('All projects you own or have joined.')
          .setColor(0x5865F2)
          .addFields(
            ...allProjects.map(p => ({
              name: p.name,
              value: `ID: ${p.id}\nOwner: ${p.ownerId === discordId ? 'You' : p.ownerId}\nCreated: <t:${Math.floor(new Date(p.createdAt).getTime() / 1000)}:F>`
            }))
          );
        return interaction.editReply({ embeds: [embed] });
      }
        let project = null;
        // Only try findByPk if input matches UUID format
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (uuidRegex.test(projectInput)) {
          project = await Project.findByPk(projectInput);
        }
        if (!project) {
          // Try by name (owned or member)
          project = await Project.findOne({ where: { ownerId: discordId, name: projectInput } });
          if (!project) {
            const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }] });
            project = memberships.map(m => m.Project).find(p => p?.name === projectInput) || null;
          }
        }
        if (!project) {
          return interaction.editReply({ content: "I can't find that project. Try `/project list`." });
        }
        const members = await ProjectMember.findAll({ where: { projectId: project.id } });
        const ownerTag = interaction.client.users.cache.get(project.ownerId)?.tag ?? project.ownerId;
        const activeSprint = await DeanSprints.findOne({ where: { projectId: project.id, status: 'processing' } }).catch(() => null);
        const channelMention = activeSprint?.channelId ? `<#${activeSprint.channelId}>` : '—';
        const mods = members.filter(m => m.role === 'mod').length;
        // Recent totals: last sprint totals + last 7 days aggregate
        let lastSprintTotal = 0;
        const lastSprint = await DeanSprints.findOne({ where: { projectId: project.id }, order: [['updatedAt', 'DESC']] }).catch(() => null);
        if (lastSprint) {
          const rows = await Wordcount.findAll({ where: { sprintId: lastSprint.id }, order: [['recordedAt', 'ASC']] });
          lastSprintTotal = rows.reduce((acc, r) => acc + ((typeof r.delta === 'number') ? Math.max(0, r.delta) : Math.max(0, (r.countEnd ?? 0) - (r.countStart ?? 0))), 0);
        }
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRows = await Wordcount.findAll({ where: { projectId: project.id, recordedAt: { [Op.gte]: since } } }).catch(() => []);
        // All-time total across all members for this project
        const allRows = await Wordcount.findAll({ where: { projectId: project.id } }).catch(() => []);
        const allTotal = allRows.reduce((acc, r) => acc + ((typeof r.delta === 'number') ? Math.max(0, r.delta) : Math.max(0, (r.countEnd ?? 0) - (r.countStart ?? 0))), 0);
        const weekTotal = recentRows.reduce((acc, r) => acc + ((typeof r.delta === 'number') ? Math.max(0, r.delta) : Math.max(0, (r.countEnd ?? 0) - (r.countStart ?? 0))), 0);
        // Build embed
        const Discord = await import('discord.js');
        const { EmbedBuilder } = Discord;
        // Try to get owner's role color
        let embedColor = 0x5865F2;
        try {
          if (interaction.guild) {
            const ownerMember = await interaction.guild.members.fetch(project.ownerId);
            if (ownerMember && ownerMember.roles && ownerMember.roles.color) {
              embedColor = ownerMember.roles.color.hexColor || embedColor;
            } else if (ownerMember && ownerMember.displayHexColor && ownerMember.displayHexColor !== '#000000') {
              embedColor = ownerMember.displayHexColor;
            }
          }
        } catch {}
        const embed = new EmbedBuilder()
          .setTitle(`Project: ${project.name}`)
          .setDescription('Project details and stats.')
          .setColor(embedColor)
          .addFields(
            { name: 'Owner', value: ownerTag, inline: true },
            { name: 'Members', value: `${members.length} (mods: ${mods})`, inline: true },
            { name: 'Active Sprint', value: activeSprint ? `Yes, in ${channelMention}` : 'No', inline: true },
            { name: 'Last Sprint Total', value: `${lastSprintTotal} words`, inline: true },
            { name: 'All-Time Total', value: `${allTotal} words`, inline: true },
            { name: '7-Day Total', value: `${weekTotal} words`, inline: true }
          )
          .setTimestamp(project.createdAt)
          .setFooter({ text: `Project ID: ${project.id} • Created: <t:${Math.floor(new Date(project.createdAt).getTime() / 1000)}:F>` });
        return interaction.editReply({ embeds: [embed] });

    if (subGroup === 'wc') {
      // Resolve project: required, can be ID or Name
      let projectInput = interaction.options.getString('project');
      let project = null;
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (uuidRegex.test(projectInput)) {
        project = await Project.findByPk(projectInput);
      }
      if (!project) {
        // Try by name (owned or member)
        project = await Project.findOne({ where: { ownerId: discordId, name: projectInput } });
        if (!project) {
          const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }] });
          project = memberships.map(m => m.Project).find(p => p?.name === projectInput) || null;
        }
      }
      if (!project) {
        return interaction.editReply({ content: 'I can’t find that project. Use the project ID or exact name.' });
      }
      const projectId = project.id;
      // Validate membership
      const membership = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!membership) {
        return interaction.editReply({ content: 'You’re not on that project, buddy.' });
      }
      const leaf = interaction.options.getSubcommand();
      if (leaf === 'add') {
        const words = interaction.options.getInteger('new-words');
        if (words <= 0) return interaction.editReply({ content: 'Words must be a positive number.' });
        await Wordcount.create({
          userId: discordId,
          projectId,
          sprintId: null,
          countStart: null,
          countEnd: null,
          delta: words,
          recordedAt: new Date(),
        });
        return interaction.editReply({ content: `Logged **+${words}** to that project. Keep it moving.` });
      } else if (leaf === 'set') {
        const count = interaction.options.getInteger('count');
        if (count < 0) return interaction.editReply({ content: 'Wordcount must be zero or greater.' });
        const rows = await Wordcount.findAll({ where: { projectId, userId: discordId }, order: [['recordedAt', 'ASC']] });
        const current = rows.reduce((acc, r) => {
          const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
          return acc + (d > 0 ? d : 0);
        }, 0);
        const delta = Math.max(0, count - current);
        if (delta === 0) return interaction.editReply({ content: `You’re already sitting at **${count}** for this project.` });
        await Wordcount.create({
          userId: discordId,
          projectId,
          sprintId: null,
          countStart: current,
          countEnd: count,
          delta,
          recordedAt: new Date(),
        });
        return interaction.editReply({ content: `Locked **${count}** as your project count (added **+${delta}**).` });
      } else if (leaf === 'show') {
        const rows = await Wordcount.findAll({ where: { projectId, userId: discordId }, order: [['recordedAt', 'ASC']] });
        const current = rows.reduce((acc, r) => {
          const d = (typeof r.delta === 'number') ? r.delta : ((r.countEnd ?? 0) - (r.countStart ?? 0));
          return acc + (d > 0 ? d : 0);
        }, 0);
        return interaction.editReply({ content: `You’re at **${current}** on this project.` });
      }
    }

    if (subName === 'list') {
      const memberships = await ProjectMember.findAll({ where: { userId: discordId }, limit: 50 });
      if (!memberships.length) {
        return interaction.editReply({ content: "You're not on any projects yet." });
      }
      const ids = memberships.map(m => m.projectId);
      const projects = await Project.findAll({ where: { id: ids } });
      const lines = projects.map(p => `• **${p.name}** (${p.id})`).join('\n');
      return interaction.editReply({ content: `Your projects:\n${lines}` });
    }

    if (subName === 'invite') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
      const requester = await User.findOne({ where: { discordId } });
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const project = await Project.findByPk(active.projectId);
      const isOwner = project && project.ownerId === discordId;
      const isPrivileged = level !== 'member';
      if (!isOwner && !isPrivileged) {
        return interaction.editReply({ content: 'Only the owner or a mod can invite folks.', ephemeral: true });
      }
      const member = interaction.options.getUser('member');
      await ProjectMember.findOrCreate({ where: { projectId: active.projectId, userId: member.id }, defaults: { role: 'member' } });
      return interaction.editReply({ content: `Pulled <@${member.id}> onto the crew.` });
    }

    if (subName === 'remove') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
      const member = interaction.options.getUser('member');
      const confirm = interaction.options.getBoolean('confirm') ?? false;
      if (!confirm) {
        return interaction.editReply({ content: `You sure you wanna boot <@${member.id}>? Re-run with **confirm:true**.` });
      }
      const requester = await User.findOne({ where: { discordId } });
      const level = (requester?.permissionLevel || 'member').toLowerCase();
      const project = await Project.findByPk(active.projectId);
      const isOwner = project && project.ownerId === discordId;
      const isPrivileged = level !== 'member';
      if (!isOwner && !isPrivileged) {
        return interaction.editReply({ content: 'Heads up: only the owner or a mod can boot folks.', ephemeral: true });
      }
      await ProjectMember.destroy({ where: { projectId: active.projectId, userId: member.id } });
      return interaction.editReply({ content: `Alright, <@${member.id}> is off the roster.` });
    }

    if (subName === 'leave') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No project hooked up to this sprint, champ.' });
      }
      const confirm = interaction.options.getBoolean('confirm') ?? false;
      if (!confirm) {
        return interaction.editReply({ content: 'You sure you wanna bail on this project? Re-run with **confirm:true**.' });
      }
      const projectId = active.projectId;
      const project = await Project.findByPk(projectId);
      if (project && project.ownerId === discordId) {
        return interaction.editReply({ content: "You're the owner, buddy. Transfer ownership first or end the project." });
      }
      await ProjectMember.destroy({ where: { projectId, userId: discordId } });
      await active.update({ projectId: null });
      return interaction.editReply({ content: 'You’re off the crew. Sprint unlinked from that project.' });
    }

    if (subName === 'use') {
      const projectInput = interaction.options.getString('project');
      let project = await Project.findByPk(projectInput);
      if (!project) {
        // Try by name (owned or member)
        project = await Project.findOne({ where: { ownerId: discordId, name: projectInput } });
        if (!project) {
          const memberships = await ProjectMember.findAll({ where: { userId: discordId }, include: [{ model: Project, as: 'Project' }] });
          project = memberships.map(m => m.Project).find(p => p?.name === projectInput) || null;
        }
      }
      if (!project) {
        return interaction.editReply({ content: "I can't find that project. Try `/project list`." });
      }
      const projectId = project.id;
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active) {
        return interaction.editReply({ content: 'No active sprint right now.' });
      }
      const member = await ProjectMember.findOne({ where: { projectId, userId: discordId } });
      if (!member) {
        return interaction.editReply({ content: 'You’re not on that project, buddy. Get invited first.' });
      }
      await active.update({ projectId });
      return interaction.editReply({ content: `Locked this sprint to project **${projectId}**. Let’s get those pages.` });
    }

    if (subName === 'members') {
      const active = await DeanSprints.findOne({ where: { userId: discordId, guildId, status: 'processing' } });
      if (!active || !active.projectId) {
        return interaction.editReply({ content: 'No active project on this sprint.' });
      }
      const members = await ProjectMember.findAll({ where: { projectId: active.projectId }, limit: 50 });
      const list = members.map(m => `• <@${m.userId}> (${m.role})`).join('\n') || 'Just you right now. That’s fine, solo hero arc.';
      return interaction.editReply({ content: `Crew roll call:\n${list}` });
    }
  } catch (err) {
    console.error('[Dean/project] Command error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Yeah, that's on me. Try that again in a sec." });
      } else {
        await interaction.reply({ content: "Yeah, that's on me. Try that again in a sec." });
      }
    } catch {}
  }
}
