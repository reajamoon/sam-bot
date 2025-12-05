import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';

// Map subcommands to fixed role IDs to avoid name mismatches
const ROLE_MAP = {
  'server-changes': '1446394468797255794',
  'fun-stuff': '1446393678800097361',
};

export const data = new SlashCommandBuilder()
  .setName('bash')
  .setDescription('Birthday Bash utilities')
  .addSubcommandGroup(group => group
    .setName('roles')
    .setDescription('Toggle your Birthday Bash roles on/off')
    .addSubcommand(sub => sub
      .setName('server-changes')
      .setDescription('Toggle the "Birthday Bash - Server Changes!" role'))
    .addSubcommand(sub => sub
      .setName('fun-stuff')
      .setDescription('Toggle the "Birthday Bash - Fun Stuff" role'))
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: 'Use this in a server so I can manage roles.', ephemeral: true });
  }

  // Defer ephemerally to avoid clutter
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  try {
    const subGroup = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    console.info('[Cas/bash] invoked', { guildId: interaction.guildId, userId: interaction.user?.id, sub });
    if (subGroup !== 'roles') {
      return interaction.editReply({ content: 'Try `/bash roles server-changes` or `/bash roles fun-stuff`.' });
    }

    const roleId = ROLE_MAP[sub];
    if (!roleId) {
      return interaction.editReply({ content: 'Unknown role option. Try one of the listed subcommands.' });
    }

    const guild = interaction.guild;
    let me = guild.members.me;
    if (!me) {
      try {
        me = await guild.members.fetchMe();
      } catch (e) {
        console.error('[Cas/bash] fetchMe failed', e);
      }
    }
    let role = guild.roles.cache.get(roleId);
    if (!role) {
      try {
        role = await guild.roles.fetch(roleId);
      } catch (e) {
        role = null;
      }
    }

    if (!role) {
      return interaction.editReply({ content: `I can't find that role (ID: ${roleId}).` });
    }

    if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.editReply({ content: 'I need the Manage Roles permission to do that.' });
    }

    if (role.position >= me.roles.highest.position) {
      return interaction.editReply({ content: 'That role is higher than mine. Ask a mod to adjust my role position.' });
    }

    let member = interaction.member;
    // Ensure we have a full GuildMember (not APIInteractionGuildMember)
    if (!member || typeof member.roles?.add !== 'function') {
      try {
        member = await guild.members.fetch(interaction.user.id);
      } catch (e) {
        console.error('[Cas/bash] fetch member failed', e);
        return interaction.editReply({ content: 'I couldn\'t load your member record to edit roles. Try again in a moment or ping a mod.' });
      }
    }
    const roleLabel = role?.name ?? 'that role';
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Self-serve Birthday Bash role toggle (remove)');
      return interaction.editReply({ content: `Got it — removed **${roleLabel}**.` });
    } else {
      await member.roles.add(role, 'Self-serve Birthday Bash role toggle (add)');
      return interaction.editReply({ content: `All set — added **${roleLabel}**.` });
    }
  } catch (err) {
    console.error('[Cas/bash roles] Error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'Something went sideways while adding the role. Try again or ping a mod.' });
      } else {
        await interaction.reply({ content: 'Something went sideways while adding the role. Try again or ping a mod.', ephemeral: true });
      }
    } catch {}
  }
}
