// Handler to clear all queue jobs for a fic URL (admin/mod only)
const { InteractionFlags } = require('discord.js');
const { ParseQueue } = require('../../../../models');

module.exports = async function handleClearQueue(interaction) {
  const { MessageFlags } = require('discord.js');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  // Allow only admins or mods
  if (!interaction.member.permissions.has('ManageGuild') && !interaction.member.permissions.has('ManageMessages')) {
    await interaction.editReply({ content: 'You need the Manage Server or Manage Messages permission to use this command.' });
    return;
  }
  const url = interaction.options.getString('url');
  if (!url) {
    await interaction.editReply({ content: 'You must provide a fic URL to clear.' });
    return;
  }
  const deleted = await ParseQueue.destroy({ where: { fic_url: url } });
  if (deleted > 0) {
    await interaction.editReply({ content: `Cleared ${deleted} queue entr${deleted === 1 ? 'y' : 'ies'} for that fic.` });
  } else {
    await interaction.editReply({ content: 'No queue entries found for that fic URL.' });
  }
};