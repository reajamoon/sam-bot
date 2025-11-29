import updateMessages from '../../../../shared/text/updateMessages.js';
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import { saveUserMetadata } from '../../../../shared/recUtils/processUserMetadata.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import { Recommendation, Config } from '../../../../models/index.js';
import { User } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecommendationEmbed } from '../../../../shared/recUtils/asyncEmbeds.js';
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { getLockedFieldsForRec } from '../../../../shared/getLockedFieldsForRec.js';
import { isFieldGloballyModlocked } from '../../../../shared/modlockUtils.js';
import { validateDeanCasRec } from '../../../../shared/recUtils/ao3/validateDeanCasRec.js';
// import { markPrimaryAndNotPrimaryWorks } from './seriesUtils.js';

// Adds a new fic rec. Checks for duplicates, fetches metadata, and builds the embed.
export default async function handleAddRecommendation(interaction) {

  try {
    await interaction.deferReply();
    let url = interaction.options.getString('url');
    url = normalizeAO3Url(url);
    const manualTitle = interaction.options.getString('title');
    const manualAuthor = interaction.options.getString('author');
    const manualSummary = interaction.options.getString('summary');
    const manualWordCount = interaction.options.getInteger('wordcount');
    let manualRating = interaction.options.getString('rating');
    manualRating = normalizeRating(manualRating);
    const manualChapters = interaction.options.getString('chapters');
    const manualStatus = interaction.options.getString('status');
    const manualArchiveWarnings = interaction.options.getString('archive_warnings');
    const manualSeriesName = interaction.options.getString('seriesName');
    const manualSeriesPart = interaction.options.getInteger('seriesPart');
    const manualSeriesUrl = interaction.options.getString('seriesUrl');
    // Robust tag parsing and deduplication
    let additionalTags = interaction.options.getString('tags')
      ? interaction.options.getString('tags').split(',').map(t => t.trim()).filter(Boolean)
      : [];
    // Deduplicate, case-insensitive
    additionalTags = Array.from(new Set(additionalTags.map(t => t.toLowerCase())));
    const notes = interaction.options.getString('notes');
    // --- ModLock enforcement for re-adds ---
    // We'll check for modlocks by ao3ID if this is a new rec
    let ao3ID = null;
    const ao3Match = url.match(/archiveofourown\.org\/(works|series)\/(\d+)/);
    if (ao3Match) {
      ao3ID = parseInt(ao3Match[2], 10);
    }
    // Check if a previously deleted fic exists (by ao3ID)
    let previouslyDeleted = false;
    if (ao3ID) {
      // Find any recs that ever existed for this ao3ID (including soft-deleted if you add that in future)
      const prevRec = await Recommendation.findOne({ where: { ao3ID } });
      if (!prevRec) {
        // Check for any modlocks for this ao3ID (from previously deleted recs)
        const { ModLock } = await import('../../../../models/index.js');
        const locks = await ModLock.findAll({
          where: { locked: true },
          include: [{
            model: Recommendation,
            as: 'recommendation',
            where: { ao3ID },
            required: true
          }]
        });
        if (locks.length > 0) {
          previouslyDeleted = true;
        }
      }
    }
    // If previously deleted, DM all superadmins
    if (previouslyDeleted && interaction.client) {
      const superadmins = await User.findAll({ where: { permissionLevel: 'superadmin' } });
      for (const admin of superadmins) {
        try {
          const userObj = await interaction.client.users.fetch(admin.discordId);
          if (userObj) {
            await userObj.send(`A fic with AO3 ID ${ao3ID} was re-added, but modlocks exist from a previously deleted rec. Please review and fix metadata if needed.`);
          }
        } catch (err) {
          console.error('Failed to DM superadmin:', admin.discordId, err);
        }
      }
    }
    let modLocksByField = {};
    // If rec exists, get per-rec locks and merge with global locks
    let rec = null;
    if (ao3ID) {
      rec = await Recommendation.findOne({ where: { ao3ID } });
      if (rec) {
        const lockedFields = await getLockedFieldsForRec(rec.id);
        for (const field of lockedFields) modLocksByField[field] = true;
      }
    }
    // Add global modlocks to modLocksByField
    const allFields = [
      'title','summary','status','language','category','attachmentUrl','authors','tags','character_tags','fandom_tags','archive_warnings','wordCount','part','manual_seriesPart','rating','chapters','publishedDate','updatedDate','manualTitle','manualAuthor','manualSummary','manualWordCount','manualRating','manualChapters','manualStatus','manualArchiveWarnings','manualSeriesName','manualSeriesPart','manualSeriesUrl','rec_note','additional_tags'
    ];
    for (const field of allFields) {
      if (await isFieldGloballyModlocked(field)) {
        modLocksByField[field] = true;
      }
    }
    if (!url || !isValidFanficUrl(url)) {
      return await interaction.editReply({
        content: 'Please provide a valid fanfiction URL (AO3, FFNet, Wattpad, etc.)'
      }); // Not in updateMessages, but could be added if reused
    }
    // --- AO3 fandom/ship validation ---
    // You must extract fandomTags and relationshipTags from the interaction or fetched metadata.
    // For this example, assume they are provided as options (replace with actual extraction as needed):
    // e.g. interaction.options.getString('fandom_tags'), interaction.options.getString('relationship_tags')
    let fandomTags = interaction.options.getString('fandom_tags');
    let relationshipTags = interaction.options.getString('relationship_tags');
    if (typeof fandomTags === 'string') fandomTags = fandomTags.split(',').map(t => t.trim()).filter(Boolean);
    if (typeof relationshipTags === 'string') relationshipTags = relationshipTags.split(',').map(t => t.trim()).filter(Boolean);
    // If you fetch these from AO3 metadata, replace above with actual source.
    if (fandomTags && relationshipTags) {
      const validation = validateDeanCasRec(fandomTags, relationshipTags);
      if (!validation.valid) {
        // Post to mod mail (replace with your actual mod mail channel logic)
        // Fetch modmail channel ID from Config table
        let modMailChannelId = null;
        const configEntry = await Config.findOne({ where: { key: 'modmail_channel_id' } });
        if (configEntry) modMailChannelId = configEntry.value;
        if (interaction.client && modMailChannelId) {
          const channel = await interaction.client.channels.fetch(modMailChannelId).catch(() => null);
          if (channel) {
            await channel.send(`Rec by <@${interaction.user.id}> failed validation: ${validation.reason}\nURL: ${url}`);
          }
        }
        return await interaction.editReply({
          content: `This fic does not meet the library's requirements: ${validation.reason}. It has been sent to the mods for review.`,
        });
      }
    }
    if (/archiveofourown\.org\/series\//.test(url)) {
      // Check if series already exists
      const { Series } = await import('../../../../models/index.js');
      const existingSeries = await Series.findOne({ where: { url } });
      if (existingSeries) {
        const addedDate = existingSeries.createdAt ? `<t:${Math.floor(new Date(existingSeries.createdAt).getTime()/1000)}:F>` : '';
        // UserFicMetadata already saved above via saveUserMetadata
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
        // Series was already processed, UserFicMetadata already saved above
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
        // UserFicMetadata already saved above via saveUserMetadata
        if (interaction.user.id === '638765542739673089') {
          return await interaction.editReply({
            content: `Alright, overachiever—*${existingRec.title}* is already in the library${addedDate ? `, since ${addedDate}` : ''}. I swear, I’m not lying to you. (But if you want to recommend it a third time, I’ll start keeping score.)`
          });
        }
        return await interaction.editReply({
          content: `Dude. You already added *${existingRec.title}* to the library${addedDate ? `, on ${addedDate}` : ''}. I know you’re excited, but even I can’t recommend the same fic twice. (Nice try though.)`
        });
      }
      // UserFicMetadata already saved above via saveUserMetadata
      return await interaction.editReply({
        content: `*${existingRec.title}* was already added to the library by **${existingRec.recommendedByUsername}**${addedDate ? `, on ${addedDate}` : ''}! Great minds think alike though.`
      });
    }
    // Step 1: Save user metadata immediately using new architecture
    const manualFields = {};
    if (manualTitle) manualFields.title = manualTitle;
    if (manualAuthor) manualFields.author = manualAuthor;
    if (manualSummary) manualFields.summary = manualSummary;
    if (manualWordCount) manualFields.wordCount = manualWordCount;
    if (manualRating) manualFields.rating = manualRating;
    if (manualChapters) manualFields.chapters = manualChapters;
    if (manualStatus) manualFields.status = manualStatus;
    if (manualArchiveWarnings) manualFields.archiveWarnings = manualArchiveWarnings;
    if (manualSeriesName) manualFields.seriesName = manualSeriesName;
    if (manualSeriesPart) manualFields.seriesPart = manualSeriesPart;
    if (manualSeriesUrl) manualFields.seriesUrl = manualSeriesUrl;

    // Save user metadata immediately (before queue processing)
    await saveUserMetadata({
      url,
      user: interaction.user,
      notes: notes || '',
      additionalTags: additionalTags || [],
      manualFields
    });

    // Step 2: Queue URL only (no user metadata in payload)
    const { queueEntry, status, message } = await createOrJoinQueueEntry(url, interaction.user.id);
    if (status === 'processing') {
      return await interaction.editReply({
        content: message || updateMessages.alreadyProcessing
      });
    } else if (status === 'done' && queueEntry.result) {
      // Return cached result: fetch Recommendation and build embed directly (no AO3 access)
      const rec = await Recommendation.findOne({ where: { url } });
      if (rec) {
        // UserFicMetadata already saved above, just build embed
        const recWithSeries = await fetchRecWithSeries(rec.id, true);
        // For additional tags, always concat (deduplication later)

        const recFields = {};
        // Helper for string fields
        function validString(val, current) {
          return val && typeof val === 'string' && val.trim() && val !== current;
        }
        // Helper for array fields
        function validArray(val, current) {
          return Array.isArray(val) && (!Array.isArray(current) || val.some(v => !current.includes(v)));
        }
        // Helper for number fields
        function validNumber(val, current) {
          return typeof val === 'number' && val !== current;
        }
        // String fields
        if (!modLocksByField['title'] && validString(manualTitle, rec.title)) recFields.title = manualTitle;
        if (!modLocksByField['summary'] && validString(manualSummary, rec.summary)) recFields.summary = manualSummary;
        if (!modLocksByField['status'] && validString(interaction.options.getString('status'), rec.status)) recFields.status = interaction.options.getString('status');
        if (!modLocksByField['language'] && validString(interaction.options.getString('language'), rec.language)) recFields.language = interaction.options.getString('language');
        if (!modLocksByField['category'] && validString(interaction.options.getString('category'), rec.category)) recFields.category = interaction.options.getString('category');
        if (!modLocksByField['attachmentUrl'] && validString(interaction.options.getString('attachmentUrl'), rec.attachmentUrl)) recFields.attachmentUrl = interaction.options.getString('attachmentUrl');
        // Array fields
        if (!modLocksByField['authors'] && manualAuthor && Array.isArray(rec.authors) && (!rec.authors.includes(manualAuthor) || rec.authors.length === 0)) {
          recFields.authors = [...rec.authors, manualAuthor];
        }
        if (!modLocksByField['tags'] && Array.isArray(additionalTags) && additionalTags.length > 0) {
          recFields.tags = Array.isArray(rec.tags) ? rec.tags.concat(additionalTags) : additionalTags;
        }
        if (!modLocksByField['character_tags'] && validArray(interaction.options.getString('character_tags'), rec.character_tags)) {
          recFields.character_tags = rec.character_tags ? rec.character_tags.concat(interaction.options.getString('character_tags')) : [interaction.options.getString('character_tags')];
        }
        if (!modLocksByField['fandom_tags'] && validArray(interaction.options.getString('fandom_tags'), rec.fandom_tags)) {
          recFields.fandom_tags = rec.fandom_tags ? rec.fandom_tags.concat(interaction.options.getString('fandom_tags')) : [interaction.options.getString('fandom_tags')];
        }
        if (!modLocksByField['archive_warnings'] && validArray(interaction.options.getString('archive_warnings'), rec.archive_warnings)) {
          recFields.archive_warnings = rec.archive_warnings ? rec.archive_warnings.concat(interaction.options.getString('archive_warnings')) : [interaction.options.getString('archive_warnings')];
        }
        // Number fields
        if (!modLocksByField['wordCount'] && validNumber(manualWordCount, rec.wordCount)) recFields.wordCount = manualWordCount;
        if (!modLocksByField['part'] && validNumber(interaction.options.getInteger('part'), rec.part)) recFields.part = interaction.options.getInteger('part');
        if (!modLocksByField['manual_seriesPart'] && validNumber(interaction.options.getInteger('manual_seriesPart'), rec.manual_seriesPart)) recFields.manual_seriesPart = interaction.options.getInteger('manual_seriesPart');
        // Other fields
        if (!modLocksByField['rating'] && validString(manualRating, rec.rating)) recFields.rating = manualRating;
        if (!modLocksByField['chapters'] && validString(interaction.options.getString('chapters'), rec.chapters)) recFields.chapters = interaction.options.getString('chapters');
        if (!modLocksByField['publishedDate'] && validString(interaction.options.getString('publishedDate'), rec.publishedDate)) recFields.publishedDate = interaction.options.getString('publishedDate');
        if (!modLocksByField['updatedDate'] && validString(interaction.options.getString('updatedDate'), rec.updatedDate)) recFields.updatedDate = interaction.options.getString('updatedDate');
        // Never update notes (deprecated)
        // Update Recommendation if any fields are valid
        if (Object.keys(recFields).length > 0) {
          await rec.update(recFields);
          // Refresh recWithSeries after update
          const updatedRecWithSeries = await fetchRecWithSeries(rec.id, true);
          const embed = await createRecommendationEmbed(updatedRecWithSeries);
        } else {
          // Use existing recWithSeries
          const embed = await createRecommendationEmbed(recWithSeries);
        }
        await interaction.editReply({
            content: null,
            embeds: [embed]
          });
      } else {
            await interaction.editReply({
            content: 'Recommendation found in queue but not in database. Please try again or contact an admin.'
            });
      } return;
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