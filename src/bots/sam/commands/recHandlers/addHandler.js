import updateMessages from '../../../../shared/text/updateMessages.js';
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import { saveUserMetadata } from '../../../../shared/recUtils/processUserMetadata.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import { Recommendation, Config } from '../../../../models/index.js';
import { User } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecEmbed } from '../../../../shared/recUtils/createRecEmbed.js';
import { createSeriesEmbed } from '../../../../shared/recUtils/createSeriesEmbed.js';
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { getLockedFieldsForRec } from '../../../../shared/getLockedFieldsForRec.js';
import { isFieldGloballyModlockedFor } from '../../../../shared/modlockUtils.js';
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
    // Only normalize rating if user provided it; otherwise keep null
    let manualRating = interaction.options.getString('rating');
    if (manualRating && manualRating.trim()) {
      manualRating = normalizeRating(manualRating);
    } else {
      manualRating = null;
    }
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
          where: {
            ao3ID: String(ao3ID),
            locked: true
          }
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
        const lockedFields = await getLockedFieldsForRec(rec, interaction.user);
        for (const field of lockedFields) modLocksByField[field] = true;
      }
    }
    // Add global modlocks to modLocksByField
    const allFields = [
      'title','summary','status','language','category','attachmentUrl','authors','tags','character_tags','fandom_tags','archive_warnings','wordCount','part','manual_seriesPart','rating','chapters','publishedDate','updatedDate','manualTitle','manualAuthor','manualSummary','manualWordCount','manualRating','manualChapters','manualStatus','manualArchiveWarnings','manualSeriesName','manualSeriesPart','manualSeriesUrl','rec_note','additional_tags'
    ];
    for (const field of allFields) {
      if (await isFieldGloballyModlockedFor(interaction.user, field)) {
        modLocksByField[field] = true;
      }
    }
    if (!url || !isValidFanficUrl(url)) {
      return await interaction.editReply({
        content: 'Please provide a valid fanfiction URL (AO3, FFNet, Wattpad, etc.)'
      }); // Not in updateMessages, but could be added if reused
    }

      // Enforce per-user daily successful-add limit (count Recommendations)
      try {
        const { Config, Recommendation, Series } = await import('../../../../models/index.js');
        const limitConfig = await Config.findOne({ where: { key: 'daily_rec_add_limit' } });
        const dailyLimit = limitConfig && Number(limitConfig.value) > 0 ? Number(limitConfig.value) : 10; // default 10
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { Op } = await import('sequelize');
        const successfulRecAddsToday = await Recommendation.count({
          where: {
            recommendedBy: interaction.user.id,
            createdAt: { [Op.gte]: startOfDay }
          }
        });
        // Count series adds (requires Series.recommendedBy to be set)
        const successfulSeriesAddsToday = await Series.count({
          where: {
            recommendedBy: interaction.user.id,
            createdAt: { [Op.gte]: startOfDay }
          }
        });
        const successfulAddsToday = successfulRecAddsToday + successfulSeriesAddsToday;
        if (successfulAddsToday >= dailyLimit) {
          const { MessageFlags } = await import('discord.js');
          await interaction.followUp({
            content: `You’ve hit today’s add limit (${dailyLimit}). Try again tomorrow, or ask a mod if you need a bump.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      } catch (limitErr) {
        console.warn('[rec add] Daily successful-add limit check failed; proceeding without limit:', limitErr);
      }

    if (/archiveofourown\.org\/series\//.test(url)) {
      // Check if series already exists
      const { Series } = await import('../../../../models/index.js');
      const existingSeries = await Series.findOne({ where: { url } });
      if (existingSeries) {
        // Always attach per-user notes/tags on duplicates
        await saveUserMetadata({
          url: existingSeries.url,
          user: interaction.user,
          notes: notes || '',
          additionalTags: additionalTags || []
        });
        // If record is older than 3 days, queue for refresh with serialized notes/tags
        const oneDayMs = 24 * 60 * 60 * 1000;
        const ageMs = Date.now() - new Date(existingSeries.updatedAt || existingSeries.createdAt).getTime();
        if (ageMs > oneDayMs) {
          const { queueEntry } = await createOrJoinQueueEntry(existingSeries.url, interaction.user.id);
          const additionalTagsString = Array.isArray(additionalTags)
            ? additionalTags.join(', ')
            : (typeof additionalTags === 'string' ? additionalTags : '');
          await queueEntry.update({
            notes: notes || '',
            additional_tags: additionalTagsString || null
          });
          // Do not send embed now; poller will send one when refresh completes
          await interaction.editReply({ content: null });
          try { await interaction.deleteReply(); } catch {}
          await interaction.followUp({
            content: 'Saved your note and tags; refreshing the series now and will post the updated embed shortly.',
            ephemeral: true
          });
          return;
        } else {
          // No refresh needed; send a single embed now with the user’s note override
          const embed = await createSeriesEmbed({
            series: existingSeries,
            userId: interaction.user.id,
            overrideNotes: notes || '',
            includeAdditionalTags: additionalTags || []
          });
          return await interaction.editReply({
            content: 'Saved your note and tags.',
            embeds: [embed]
          });
        }
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
          const additionalTagsString = Array.isArray(additionalTags)
            ? additionalTags.join(', ')
            : (typeof additionalTags === 'string' ? additionalTags : '');
          await queueEntry.update({
            notes: notes || '',
            additional_tags: additionalTagsString || null
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
      // Always attach per-user notes/tags on duplicates
      await saveUserMetadata({
        url: existingRec.url,
        user: interaction.user,
        notes: notes || '',
        additionalTags: additionalTags || []
      });
      // Queue for refresh if older than 3 days
      const oneDayMs = 24 * 60 * 60 * 1000;
      const ageMs = Date.now() - new Date(existingRec.updatedAt || existingRec.createdAt).getTime();
      if (ageMs > oneDayMs) {
        const { queueEntry } = await createOrJoinQueueEntry(existingRec.url, interaction.user.id);
        const additionalTagsString = Array.isArray(additionalTags)
          ? additionalTags.join(', ')
          : (typeof additionalTags === 'string' ? additionalTags : '');
        await queueEntry.update({
          notes: notes || '',
          additional_tags: additionalTagsString || null
        });
        // Do not send embed now; poller will send one when refresh completes
        await interaction.editReply({ content: null });
        try { await interaction.deleteReply(); } catch {}
        await interaction.followUp({
          content: 'Saved your note and tags; refreshing the fic now and will post the updated embed shortly.',
          ephemeral: true
        });
        return;
      } else {
        // No refresh needed; send a single embed now with the user’s note override
        const recWithSeries = await fetchRecWithSeries(existingRec.id, true);
        const embed = createRecEmbed(recWithSeries, {
          overrideNotes: notes || '',
          userId: interaction.user.id,
          includeAdditionalTags: additionalTags || []
        });
        return await interaction.editReply({
          content: 'Saved your note and tags.',
          embeds: [embed]
        });
      }
    }
    // Step 1: Save user metadata immediately using new architecture
    const manualFields = {};
    if (manualTitle) manualFields.title = manualTitle;
    if (manualAuthor) manualFields.author = manualAuthor;
    if (manualSummary) manualFields.summary = manualSummary;
    if (manualWordCount) manualFields.wordCount = manualWordCount;
    if (manualRating !== null) manualFields.rating = manualRating;
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
          const embed = createRecEmbed(updatedRecWithSeries);
        } else {
          // Use existing recWithSeries
          const embed = createRecEmbed(recWithSeries);
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
        const additionalTagsString = Array.isArray(additionalTags)
          ? additionalTags.join(', ')
          : (typeof additionalTags === 'string' ? additionalTags : '');
        await queueEntry.update({
          notes: notes || '',
          additional_tags: additionalTagsString || null
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