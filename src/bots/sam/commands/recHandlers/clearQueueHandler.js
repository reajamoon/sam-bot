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
    await interaction.editReply({ content: 'You must provide a fic or series URL to clear.' });
    return;
  }
  let urlsToClear = [url];
  // If this is an AO3 series URL, fetch all work URLs in the series
  if (/archiveofourown\.org\/series\//.test(url)) {
    try {
      const batchSeriesRecommendationJob = require('../../../../shared/recUtils/batchSeriesRecommendationJob');
      // Dummy user for parsing only
      const user = { id: 'system', username: 'system' };
      const { seriesRec, workRecs } = await batchSeriesRecommendationJob(url, user, {}, null);
      if (seriesRec && Array.isArray(seriesRec.series_works)) {
        urlsToClear = [url, ...seriesRec.series_works.map(w => w.url).filter(Boolean)];
      }
    } catch (err) {
      await interaction.editReply({ content: `Failed to parse series for work URLs: ${err.message}` });
      return;
    }
  }
  const deleted = await ParseQueue.destroy({ where: { fic_url: urlsToClear } });
  if (deleted > 0) {
    await interaction.editReply({ content: `Cleared ${deleted} queue entr${deleted === 1 ? 'y' : 'ies'} for that URL${urlsToClear.length > 1 ? 's' : ''}.` });
  } else {
    await interaction.editReply({ content: 'No queue entries found for that URL.' });
  }
};