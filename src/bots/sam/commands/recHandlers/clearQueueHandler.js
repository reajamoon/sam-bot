// Handler to clear all queue jobs for a fic URL (admin/mod only)
import { MessageFlags } from 'discord.js';
import { ParseQueue, Recommendation } from '../../../../models/index.js';

export default async function handleClearQueue(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  // Allow only admins or mods
  if (!interaction.member.permissions.has('ManageGuild') && !interaction.member.permissions.has('ManageMessages')) {
    await interaction.editReply({ content: 'You need the Manage Server or Manage Messages permission to use this command.' });
    return;
  }
  const url = interaction.options.getString('url');
  if (!url) {
    await interaction.editReply({ content: 'You must provide a fic or series URL to clear.' });
    return;
  }
  let urlsToClear = [url];
  if (/archiveofourown\.org\/series\//.test(url)) {
    try {
      const seriesRec = await Recommendation.findOne({ where: { url } });
      if (seriesRec && Array.isArray(seriesRec.series_works)) {
        urlsToClear = [url, ...seriesRec.series_works.map(w => w.url).filter(Boolean)];
      }
    } catch (err) {
      await interaction.editReply({ content: `Failed to fetch series works from database: ${err.message}` });
      return;
    }
  }
  const deleted = await ParseQueue.destroy({ where: { fic_url: urlsToClear } });
  if (deleted > 0) {
    await interaction.editReply({ content: `Cleared ${deleted} queue entr${deleted === 1 ? 'y' : 'ies'} for that URL${urlsToClear.length > 1 ? 's' : ''}.` });
  } else {
    await interaction.editReply({ content: 'No queue entries found for that URL.' });
  }
}