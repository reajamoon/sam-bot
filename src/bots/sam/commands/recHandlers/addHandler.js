import updateMessages from '../../../../shared/text/updateMessages.js';
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import processRecommendationJob from '../../../../shared/recUtils/processRecommendationJob.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import { Recommendation } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecommendationEmbed } from '../../../../shared/recUtils/asyncEmbeds.js';
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import { selectPrimaryWork } from './seriesUtils.js';

// Adds a new fic rec. Checks for duplicates, fetches metadata, and builds the embed.
export default async function handleAddRecommendation(interaction) {
  try {
    console.log('[rec add] Handler called', {
      user: interaction.user?.id,
      url: interaction.options.getString('url'),
      options: interaction.options.data
    });
    await interaction.deferReply();

    let url = interaction.options.getString('url');
    url = normalizeAO3Url(url);
    const manualTitle = interaction.options.getString('title');
    const manualAuthor = interaction.options.getString('author');
    const manualSummary = interaction.options.getString('summary');
    const manualWordCount = interaction.options.getInteger('wordcount');
    const manualRating = interaction.options.getString('rating');
    // Robust tag parsing and deduplication
    let additionalTags = interaction.options.getString('tags')
      ? interaction.options.getString('tags').split(',').map(t => t.trim()).filter(Boolean)
      : [];
    // Deduplicate, case-insensitive
    additionalTags = Array.from(new Set(additionalTags.map(t => t.toLowerCase())));
    const notes = interaction.options.getString('notes');

    if (!url || !isValidFanficUrl(url)) {
      return await interaction.editReply({
        content: 'Please provide a valid fanfiction URL (AO3, FFNet, Wattpad, etc.)'
      }); // Not in updateMessages, but could be added if reused
    }

    // --- Fic Parsing Queue Logic ---
    // Recommendation and createOrJoinQueueEntry already imported above
    // AO3 series batch parse logic (queue only, never handled by Sam)
    if (/archiveofourown\.org\/series\//.test(url)) {
      // Check if series already exists
      const { Series } = await import('../../../../models/index.js');
      const existingSeries = await Series.findOne({ where: { url } });
      if (existingSeries) {
        const addedDate = existingSeries.createdAt ? `<t:${Math.floor(new Date(existingSeries.createdAt).getTime()/1000)}:F>` : '';
        return await interaction.editReply({
          content: `*${existingSeries.name || existingSeries.title || 'Series'}* (series) is already in the library${addedDate ? `, since ${addedDate}` : ''}.`
        });
      }
      // Add the series to the processing queue (never fetch AO3 directly)
      const { queueEntry, status, message } = await createOrJoinQueueEntry(url, interaction.user.id);
      if (status === 'processing') {
        return await interaction.editReply({
          content: message || updateMessages.alreadyProcessing
        });
      } else if (status === 'done' && queueEntry.result) {
        // Series was already processed, but we only care about the entry
        await interaction.editReply({
          content: 'Series is already in the queue and ready. No works have been imported. Use `/rec add <work url>` to import works if they require their own recs.'
        });
      } else if (status === 'error') {
        return await interaction.editReply({
          content: message || updateMessages.errorPreviously
        });
      } else if (status === 'created') {
        // Optionally, update notes/additional_tags if provided (for new entry only)
        if (notes || (additionalTags && additionalTags.length > 0)) {
          await queueEntry.update({
            notes: notes || '',
            additional_tags: additionalTags
          });
        }
        return await interaction.editReply({
          content: updateMessages.addedToQueue + ' No works have been imported. Use `/rec add <work url>` to import works if they require their own recs.'
        });
      } else {
        // Fallback for any other status
        return await interaction.editReply({
          content: message || updateMessages.alreadyInQueue
        });
      }
    }
    // Check if fic is already in the library
    const existingRec = await Recommendation.findOne({ where: { url } });
    if (existingRec) {
      const addedDate = existingRec.createdAt ? `<t:${Math.floor(new Date(existingRec.createdAt).getTime()/1000)}:F>` : '';
      // Sassiest message for user 638765542739673089 if they try to add their own rec again hehehe
      if (interaction.user.id === existingRec.recommendedBy) {
        if (interaction.user.id === '638765542739673089') {
          return await interaction.editReply({
            content: `Alright, overachiever—*${existingRec.title}* is already in the library${addedDate ? `, since ${addedDate}` : ''}. I swear, I’m not lying to you. (But if you want to recommend it a third time, I’ll start keeping score.)`
          });
        }
        return await interaction.editReply({
          content: `Dude. You already added *${existingRec.title}* to the library${addedDate ? `, on ${addedDate}` : ''}. I know you’re excited, but even I can’t recommend the same fic twice. (Nice try though.)`
        });
      }
      return await interaction.editReply({
        content: `*${existingRec.title}* was already added to the library by **${existingRec.recommendedByUsername}**${addedDate ? `, on ${addedDate}` : ''}! Great minds think alike though.`
      });
    }
    // Use modular queue utility
    const { queueEntry, status, message } = await createOrJoinQueueEntry(url, interaction.user.id);
    if (status === 'processing') {
      return await interaction.editReply({
        content: message || updateMessages.alreadyProcessing
      });
    } else if (status === 'done' && queueEntry.result) {
      // Return cached result: fetch Recommendation and build embed directly (no AO3 access)
      const rec = await Recommendation.findOne({ where: { url } });
      if (rec) {
        const recWithSeries = await fetchRecWithSeries(rec.id, true);
        const embed = await createRecommendationEmbed(recWithSeries);
        await interaction.editReply({
          content: null,
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: 'Recommendation found in queue but not in database. Please try again or contact an admin.'
        });
      }
      return;
    } else if (status === 'error') {
      return await interaction.editReply({
        content: message || updateMessages.errorPreviously
      });
    } else if (status === 'created') {
      // Optionally, update notes/additional_tags if provided (for new entry only)
      if (notes || (additionalTags && additionalTags.length > 0)) {
        await queueEntry.update({
          notes: notes || '',
          additional_tags: additionalTags
        });
      }
      return await interaction.editReply({
        content: updateMessages.addedToQueue
      });
    } else {
      // Fallback for any other status
      return await interaction.editReply({
        content: message || updateMessages.alreadyInQueue
      });
    }
  } catch (error) {
    try {
      await interaction.editReply({
        content: error.message || 'There was an error adding the recommendation. Please try again.'
      });
    } catch (replyError) {
      console.error('Failed to send error message in /rec add:', replyError);
    }
    return;
  }
}