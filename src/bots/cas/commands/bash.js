import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';

const ROLE_MAP = {
  'server-changes': 'Birthday Bash - Server Changes!',
  'fun-stuff': 'Birthday Bash - Fun Stuff',
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
    if (subGroup !== 'roles') {
      return interaction.editReply({ content: 'Try `/bash roles server-changes` or `/bash roles fun-stuff`.' });
    }

    const roleName = ROLE_MAP[sub];
    if (!roleName) {
      return interaction.editReply({ content: 'Unknown role option. Try one of the listed subcommands.' });
    }

    const guild = interaction.guild;
    const me = guild.members.me;
    const role = guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
      return interaction.editReply({ content: `I can\'t find the role: ${roleName}` });
    }

    if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.editReply({ content: 'I need the Manage Roles permission to do that.' });
    }

    if (role.position >= me.roles.highest.position) {
      return interaction.editReply({ content: 'That role is higher than mine. Ask a mod to adjust my role position.' });
    }

    const member = interaction.member;
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Self-serve Birthday Bash role toggle (remove)');
      return interaction.editReply({ content: `Got it — removed **${role.name}**.` });
    } else {
      await member.roles.add(role, 'Self-serve Birthday Bash role toggle (add)');
      return interaction.editReply({ content: `All set — added **${role.name}**.` });
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
