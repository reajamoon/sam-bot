const updateMessages = require('../../commands/recHandlers/updateMessages');
// processRecommendationJob.js
// Shared utility for creating/updating recommendations (used by command handlers and queue worker)

const { Recommendation } = require('../../models');
const { fetchFicMetadata } = require('./ficParser');
const createRecommendationEmbed = require('./createRecommendationEmbed');
const normalizeAO3Url = require('./normalizeAO3Url');

/**
 * Processes a recommendation job (add or update) with shared logic.
 * @param {Object} options - Job options
 * @param {string} options.url - Fic URL
 * @param {Object} options.user - User context (id, username, etc.)
 * @param {Object} [options.manualFields] - Manual fields (title, author, summary, etc.)
 * @param {string[]} [options.additionalTags] - Additional tags
 * @param {string} [options.notes] - Notes
 * @param {boolean} [options.isUpdate] - If true, update existing rec; else, create new
 * @param {Recommendation} [options.existingRec] - Existing rec (for update)
 * @param {Function} [options.notify] - Optional callback to send notifications (embed, recommendation, metadata)
 * @returns {Promise<{embed: Object, recommendation: Recommendation, error?: string}>}
 */
async function processRecommendationJob({
  url,
  user,
  manualFields = {},
  additionalTags = [],
  notes = '',
  isUpdate = false,
  existingRec = null,
  notify = null
}) {
  let metadata;
  url = normalizeAO3Url(url);
  const bypassManual = manualFields.title && manualFields.author;
  const normalizeMetadata = require('./normalizeMetadata');
  if (bypassManual) {
    metadata = {
      title: manualFields.title,
      authors: [manualFields.author],
      summary: manualFields.summary || 'Manually added recommendation',
      tags: [],
      rating: manualFields.rating || 'Not Rated',
      language: 'English',
      wordCount: manualFields.wordCount,
      url,
      archiveWarnings: []
    };
  } else {
    try {
      metadata = await fetchFicMetadata(url);
      if (metadata && metadata.url) metadata.url = normalizeAO3Url(metadata.url);
    } catch (err) {
      console.error('[processRecommendationJob] Error fetching metadata:', err);
      return { error: updateMessages.genericError };
    }
    if (!metadata) {
      console.error('[processRecommendationJob] Metadata fetch returned null for URL:', url);
      return { error: updateMessages.genericError };
    }
    if (metadata.error && metadata.error === 'Site protection detected') {
      return { error: 'Site protection detected. Manual entry required.' };
    }
    if (metadata.is404 || (metadata.error && metadata.error === '404_not_found')) {
      return { error: '404_not_found' };
    }
    if (metadata.is403) {
      return { error: '403_forbidden' };
    }
    if (metadata.isHttpError) {
      return { error: 'connection_error' };
    }
    // Allow manual override of individual fields
    if (manualFields.title) metadata.title = manualFields.title;
    if (manualFields.author) metadata.authors = [manualFields.author];
    if (manualFields.summary) metadata.summary = manualFields.summary;
    if (manualFields.wordCount) metadata.wordCount = manualFields.wordCount;
    if (manualFields.rating) metadata.rating = manualFields.rating;
    // Normalize all metadata fields before saving
    metadata = normalizeMetadata(metadata, (url.includes('archiveofourown.org') ? 'ao3' :
      url.includes('fanfiction.net') ? 'ffnet' :
      url.includes('wattpad.com') ? 'wattpad' :
      url.includes('livejournal.com') ? 'livejournal' :
      url.includes('dreamwidth.org') ? 'dreamwidth' :
      url.includes('tumblr.com') ? 'tumblr' : 'other'));
  }

  // Ensure required fields are present and valid
  if (!metadata || !metadata.title || !user || !user.id || !user.username || !url) {
    console.error('[processRecommendationJob] Missing required fields:', {
      metadata,
      user,
      url
    });
  return { error: updateMessages.genericError };
  }

  let recommendation;
  if (isUpdate && existingRec) {
    console.log('[PROCESS JOB] archiveWarnings before DB update:', metadata.archiveWarnings);
    // Merge tags: combine existing tags, new tags, and deduplicate
    let oldTags = [];
    try { oldTags = JSON.parse(existingRec.tags || '[]'); } catch { oldTags = []; }
    let newTags = Array.isArray(metadata.tags) ? metadata.tags : [];
    // Merge and deduplicate
    const mergedTags = Array.from(new Set([...oldTags, ...newTags]));

    // Merge additionalTags: never overwrite, always deduplicate
    let oldAdditional = [];
    try { oldAdditional = JSON.parse(existingRec.additionalTags || '[]'); } catch { oldAdditional = []; }
    const mergedAdditional = Array.from(new Set([...oldAdditional, ...(Array.isArray(additionalTags) ? additionalTags : [])]));

    // Only update fields if changed
    const updateFields = {};
    if (existingRec.url !== url) updateFields.url = url;
    if (existingRec.title !== metadata.title) updateFields.title = metadata.title;
    const newAuthor = (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author';
    if (existingRec.author !== newAuthor) updateFields.author = newAuthor;
    if (existingRec.summary !== metadata.summary) updateFields.summary = metadata.summary;
    if (JSON.stringify(oldTags) !== JSON.stringify(mergedTags)) updateFields.tags = JSON.stringify(mergedTags);
    if (existingRec.rating !== metadata.rating) updateFields.rating = metadata.rating;
    if (existingRec.wordCount !== metadata.wordCount) updateFields.wordCount = metadata.wordCount;
    if (existingRec.chapters !== metadata.chapters) updateFields.chapters = metadata.chapters;
    if (existingRec.status !== metadata.status) updateFields.status = metadata.status;
    if (existingRec.language !== metadata.language) updateFields.language = metadata.language;
    if (existingRec.publishedDate !== metadata.publishedDate) updateFields.publishedDate = metadata.publishedDate;
    if (existingRec.updatedDate !== metadata.updatedDate) updateFields.updatedDate = metadata.updatedDate;
    if (JSON.stringify(oldAdditional) !== JSON.stringify(mergedAdditional)) updateFields.additionalTags = JSON.stringify(mergedAdditional);
    if (existingRec.notes !== notes) updateFields.notes = notes;
    if (existingRec.kudos !== metadata.kudos) updateFields.kudos = metadata.kudos;
    if (existingRec.hits !== metadata.hits) updateFields.hits = metadata.hits;
    if (existingRec.bookmarks !== metadata.bookmarks) updateFields.bookmarks = metadata.bookmarks;
    if (existingRec.comments !== metadata.comments) updateFields.comments = metadata.comments;
    if (existingRec.category !== metadata.category) updateFields.category = metadata.category;

    // Archive warnings update
    if (Array.isArray(metadata.archiveWarnings)) {
      updateFields.archive_warnings = JSON.stringify(metadata.archiveWarnings);
    }
    if (Object.keys(updateFields).length > 0) {
      try {
        await existingRec.update(updateFields);
        await existingRec.reload();
      } catch (err) {
        console.error('[processRecommendationJob] Error updating recommendation:', {
          id: existingRec.id,
          updateFields,
          error: err,
        });
  return { error: updateMessages.genericError };
      }
    }
    recommendation = existingRec;
  } else {
    // Create new recommendation
    try {
      recommendation = await Recommendation.create({
        url,
        title: metadata.title,
        author: (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author',
        summary: metadata.summary,
        tags: JSON.stringify(Array.isArray(metadata.tags) ? metadata.tags : []),
        rating: metadata.rating,
        wordCount: metadata.wordCount,
        chapters: metadata.chapters,
        status: metadata.status,
        language: metadata.language,
        publishedDate: metadata.publishedDate,
        updatedDate: metadata.updatedDate,
        recommendedBy: user.id,
  // recommendedByUsername is intentionally never set or updated here
        additionalTags: JSON.stringify(Array.isArray(additionalTags) ? additionalTags : []),
        notes: notes,
        archive_warnings: JSON.stringify(Array.isArray(metadata.archiveWarnings) ? metadata.archiveWarnings : []),
        kudos: metadata.kudos,
        hits: metadata.hits,
        bookmarks: metadata.bookmarks,
        comments: metadata.comments,
        category: metadata.category
      });
    } catch (err) {
      console.error('[processRecommendationJob] Error creating recommendation:', {
        url,
        title: metadata.title,
        user,
        metadata,
        error: err,
      });
  return { error: updateMessages.genericError };
    }
  }

  // Always use the actual Recommendation instance for embed generation
  console.log('[PROCESS JOB] archive_warnings in Recommendation instance:', recommendation.archive_warnings);
  const embed = await createRecommendationEmbed(recommendation);
  if (typeof notify === 'function') {
    await notify(embed, recommendation, metadata);
  }
  return { embed, recommendation };
}

module.exports = processRecommendationJob;
