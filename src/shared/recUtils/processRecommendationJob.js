// processRecommendationJob.js
// Shared utility for creating/updating recommendations (used by command handlers and queue worker)

import { Recommendation, Series } from '../../models/index.js';
import { fetchFicMetadata } from './ficParser.js';
import { createRecommendationEmbed } from './asyncEmbeds.js';
import normalizeAO3Url from './normalizeAO3Url.js';
import updateMessages from '../text/updateMessages.js';
/**
 * Processes a recommendation job (add or update) with shared logic.
 * @param {Object} options - Job options
 * @param {string} options.url - Fic URL
 * @param {Object} options.user - User context (id, username, etc.)
 * @param {Object} [options.manualFields] - Manual fields (title, authors, summary, etc.)
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
  const normalizeMetadataModule = await import('./normalizeMetadata.js');
  const normalizeMetadata = normalizeMetadataModule.default || normalizeMetadataModule;
  if (bypassManual) {
    metadata = {
      title: manualFields.title,
      authors: manualFields.authors || (manualFields.author ? [manualFields.author] : undefined),
      summary: manualFields.summary || 'Manually added recommendation',
      tags: [],
      rating: manualFields.rating || 'Not Rated',
      language: 'English',
      wordCount: manualFields.wordCount,
      url,
      archiveWarnings: [],
      type: manualFields.type,
      works: manualFields.works,
    };
  } else {
    try {
      metadata = await fetchFicMetadata(url);
      // Unwrap { metadata } if present (AO3 parser returns { metadata: ... })
      if (metadata && metadata.metadata && typeof metadata.metadata === 'object') {
        metadata = metadata.metadata;
      }
      // Restore all relevant stats fields to top-level if present in stats (AO3 parser moves them)
      if (metadata && metadata.stats) {
        const statsMap = {
          rating: 'rating',
          words: 'wordCount',
          chapters: 'chapters',
          status: 'status',
          published: 'publishedDate',
          updated: 'updatedDate',
          kudos: 'kudos',
          hits: 'hits',
          bookmarks: 'bookmarks',
          comments: 'comments',
        };
        for (const [statsKey, metaKey] of Object.entries(statsMap)) {
          if (metadata.stats[statsKey] !== undefined && metadata[metaKey] === undefined) {
            metadata[metaKey] = metadata.stats[statsKey];
          }
        }
      }
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
  if (manualFields.authors) metadata.authors = manualFields.authors;
  else if (manualFields.author) metadata.authors = [manualFields.author];
  if (manualFields.summary) metadata.summary = manualFields.summary;
  if (manualFields.wordCount) metadata.wordCount = manualFields.wordCount;
  if (manualFields.rating) metadata.rating = manualFields.rating;
  // Always override status with manual value if provided
  if (manualFields.status) metadata.status = manualFields.status;
    // Normalize all metadata fields before saving
    metadata = normalizeMetadata(metadata, (url.includes('archiveofourown.org') ? 'ao3' :
      url.includes('fanfiction.net') ? 'ffnet' :
      url.includes('wattpad.com') ? 'wattpad' :
      url.includes('livejournal.com') ? 'livejournal' :
      url.includes('dreamwidth.org') ? 'dreamwidth' :
      url.includes('tumblr.com') ? 'tumblr' : 'other'));

    // Prefer manualFields.notes over AO3 metadata.notes
    if (manualFields.notes && manualFields.notes.trim()) {
      notes = manualFields.notes.trim();
    } else if (metadata.notes && metadata.notes.trim()) {
      notes = metadata.notes.trim();
    } else {
      notes = '';
    }
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
  // Extract AO3 work ID for this work
  const ao3ID = extractAO3WorkId(url);
  // If this is an AO3 series, always upsert Series and link Recommendation
  let seriesId = null;
  if (metadata && metadata.type === 'series' && Array.isArray(metadata.works)) {
    const seriesUpsert = {
      name: metadata.seriesTitle || metadata.title || metadata.name || 'Untitled Series',
      url: (metadata.series && metadata.series[0] && metadata.series[0].url) || (metadata.seriesUrl) || (metadata.url && metadata.url.includes('/series/') ? metadata.url : null),
      summary: metadata.seriesSummary || metadata.summary || '',
      ao3SeriesId: extractAO3SeriesId((metadata.series && metadata.series[0] && metadata.series[0].url) || metadata.url),
      authors: metadata.authors || [],
      workCount: metadata.workCount || (Array.isArray(metadata.works) ? metadata.works.length : null),
      wordCount: metadata.wordCount || null,
      status: metadata.status || null,
      workIds: Array.isArray(metadata.works) ? metadata.works.map(w => w.url && w.url.match(/works\/(\d+)/)?.[1]).filter(Boolean) : [],
      series_works: Array.isArray(metadata.works) ? metadata.works.map(w => ({ title: w.title, url: w.url, authors: w.authors })) : []
    };
    // Defensive: require a valid URL for upsert
    if (seriesUpsert.url) {
      const [seriesRow] = await Series.upsert(seriesUpsert, { returning: true, conflictFields: ['url'] });
      if (seriesRow && seriesRow.id) {
        seriesId = seriesRow.id;
      }
    }
  }
  if (isUpdate && existingRec) {
    console.log('[PROCESS JOB] archiveWarnings before DB update:', metadata.archiveWarnings);
    // Merge tags: combine existing tags, new tags, and deduplicate
    let oldTags = [];
    if (Array.isArray(existingRec.tags)) {
      oldTags = existingRec.tags;
    } else if (typeof existingRec.tags === 'string') {
      try { oldTags = JSON.parse(existingRec.tags); } catch { oldTags = []; }
    }
    let newTags = Array.isArray(metadata.tags) ? metadata.tags : [];
    // Merge and deduplicate
    const mergedTags = Array.from(new Set([...oldTags, ...newTags]));

    // Merge additionalTags: never overwrite, always deduplicate
    let oldAdditional = [];
    if (Array.isArray(existingRec.additionalTags)) {
      oldAdditional = existingRec.additionalTags;
    } else if (typeof existingRec.additionalTags === 'string') {
      try { oldAdditional = JSON.parse(existingRec.additionalTags); } catch { oldAdditional = []; }
    }
    const mergedAdditional = Array.from(new Set([...oldAdditional, ...(Array.isArray(additionalTags) ? additionalTags : [])]));

    // Only update fields if changed
    const updateFields = {};
    if (existingRec.url !== url) updateFields.url = url;
    if (existingRec.title !== metadata.title) updateFields.title = metadata.title;
    // Always update authors array
    let newAuthors = metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']);
    // Compare arrays by value
    const authorsChanged = !Array.isArray(existingRec.authors) || existingRec.authors.length !== newAuthors.length || existingRec.authors.some((a, i) => a !== newAuthors[i]);
    if (authorsChanged) updateFields.authors = newAuthors;
    // For legacy support, update author field to first author
    const newAuthor = newAuthors[0] || 'Unknown Author';
    if (existingRec.author !== newAuthor) updateFields.author = newAuthor;
    if (existingRec.summary !== metadata.summary) updateFields.summary = metadata.summary;
    if (JSON.stringify(oldTags) !== JSON.stringify(mergedTags)) updateFields.tags = mergedTags;
    if (existingRec.rating !== metadata.rating) updateFields.rating = metadata.rating;
    if (existingRec.wordCount !== metadata.wordCount) updateFields.wordCount = metadata.wordCount;
    if (existingRec.chapters !== metadata.chapters) updateFields.chapters = metadata.chapters;
    if (existingRec.status !== metadata.status) updateFields.status = metadata.status;
    if (existingRec.language !== metadata.language) updateFields.language = metadata.language;
    if (existingRec.publishedDate !== metadata.publishedDate) updateFields.publishedDate = metadata.publishedDate;
    if (existingRec.updatedDate !== metadata.updatedDate) updateFields.updatedDate = metadata.updatedDate;
  if (JSON.stringify(oldAdditional) !== JSON.stringify(mergedAdditional)) updateFields.additionalTags = mergedAdditional;
    // Only overwrite notes if the new value is non-empty and different, or if the existing value is empty
    if (
      (notes && notes.trim() && existingRec.notes !== notes) ||
      (!existingRec.notes && notes !== undefined)
    ) {
      updateFields.notes = notes;
    }
    if (existingRec.kudos !== metadata.kudos) updateFields.kudos = metadata.kudos;
    if (existingRec.hits !== metadata.hits) updateFields.hits = metadata.hits;
    if (existingRec.bookmarks !== metadata.bookmarks) updateFields.bookmarks = metadata.bookmarks;
    if (existingRec.comments !== metadata.comments) updateFields.comments = metadata.comments;
    if (existingRec.category !== metadata.category) updateFields.category = metadata.category;
    // No longer update series_works. Series linkage is handled by seriesId.
    if (existingRec.ao3ID !== ao3ID) updateFields.ao3ID = ao3ID;

    // Archive warnings update
    if (Array.isArray(metadata.archiveWarnings)) {
      updateFields.archive_warnings = metadata.archiveWarnings;
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
        // Deprecated: author (for legacy)
        author: (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author',
        // Canonical: authors array
        authors: metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']),
        summary: metadata.summary,
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        rating: metadata.rating,
        wordCount: metadata.wordCount,
        chapters: metadata.chapters,
        status: metadata.status,
        language: metadata.language,
        publishedDate: metadata.publishedDate,
        updatedDate: metadata.updatedDate,
        recommendedBy: user.id,
        recommendedByUsername: user.username,
        additionalTags: Array.isArray(additionalTags) ? additionalTags : [],
        notes: notes,
        archive_warnings: Array.isArray(metadata.archiveWarnings) ? metadata.archiveWarnings : [],
        kudos: metadata.kudos,
        hits: metadata.hits,
        bookmarks: metadata.bookmarks,
        comments: metadata.comments,
        category: metadata.category,
        ao3ID,
        ...(seriesId ? { seriesId } : {})
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
  // Ensure recommendation is a Sequelize instance with a valid id
  if (!recommendation || !recommendation.id) {
    // Fallback: try to reload from DB by URL
    recommendation = await Recommendation.findOne({ where: { url } });
  }
  console.log('[PROCESS JOB] archive_warnings in Recommendation instance:', recommendation && recommendation.archive_warnings);
  const embed = await createRecommendationEmbed(recommendation);
  if (typeof notify === 'function') {
    await notify(embed, recommendation, metadata);
  }
  return { embed, recommendation };
}

function extractAO3WorkId(url) {
  const match = url && url.match(/\/works\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
function extractAO3SeriesId(url) {
  const match = url && url.match(/\/series\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default processRecommendationJob;
