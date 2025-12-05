// processAO3Job.js
// Clean implementation for processing AO3 data (used by queue worker)
// User metadata (notes, manual fields) is handled separately by command handlers

import { Recommendation, Series } from '../../models/index.js';
import { fetchFicMetadata } from './ficParser.js';
import { createRecEmbed } from './createRecEmbed.js';
import normalizeAO3Url from './normalizeAO3Url.js';
import { isFieldGloballyModlocked, shouldBotsRespectGlobalModlocks } from '../utils/globalModlockUtils.js';
import updateMessages from '../text/updateMessages.js';

/**
 * Processes AO3 recommendation data from queue worker.
 * This function ONLY handles AO3 metadata - user metadata is handled separately.
 * @param {Object} payload - Job payload from queue
 * @param {number} payload.ao3ID - AO3 work ID
 * @param {number} [payload.seriesId] - Database series ID if part of a series
 * @param {Object} payload.user - User context (id, username)
 * @param {boolean} [payload.isUpdate] - Whether updating existing recommendation
 * @param {string} [payload.type] - Type: 'work' or 'series'
 * @param {boolean} [payload.notPrimaryWork] - Flag for non-primary works in series
 * @returns {Promise<{embed: Object, recommendation: Recommendation, error?: string}>}
 */
async function processAO3Job(payload) {
  const {
    ao3ID,
    seriesId,
    user,
    isUpdate = false,
    type = 'work',
    notPrimaryWork = false
  } = payload;

  // Build AO3 URL from work ID
  const url = `https://archiveofourown.org/works/${ao3ID}`;
  
  // Fetch AO3 metadata
  let metadata;
  try {
    metadata = await fetchFicMetadata(url);
    
    // Unwrap { metadata } if present (AO3 parser returns { metadata: ... })
    if (metadata && metadata.metadata && typeof metadata.metadata === 'object') {
      metadata = metadata.metadata;
    }
    
    // Restore stats fields to top-level if present in stats
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
    
    if (metadata && metadata.url) {
      metadata.url = normalizeAO3Url(metadata.url);
    }
  } catch (err) {
    console.error('[processAO3Job] Error fetching metadata:', err);
    return { error: updateMessages.genericError };
  }

  if (!metadata) {
    console.error('[processAO3Job] Metadata fetch returned null for URL:', url);
    return { error: updateMessages.genericError };
  }

  // Handle AO3 errors
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

  // Dean/Cas validation (always runs for AO3)
  try {
    const { validateDeanCasRec } = await import('./ao3/validateDeanCasRec.js');
    const fandomTags = metadata.fandom_tags || metadata.fandom || [];
    const relationshipTags = metadata.relationship_tags || [];
    const validation = validateDeanCasRec(fandomTags, relationshipTags);
    
    if (!validation.valid) {
      return { error: validation.reason || 'Failed Dean/Cas validation' };
    }
  } catch (err) {
    console.error('[processAO3Job] Error in Dean/Cas validation:', err);
    return { error: 'Dean/Cas validation error' };
  }

  // Normalize metadata for AO3
  const normalizeMetadataModule = await import('./normalizeMetadata.js');
  const normalizeMetadata = normalizeMetadataModule.default || normalizeMetadataModule;
  metadata = normalizeMetadata(metadata, 'ao3');

  // Ensure required fields
  if (!metadata || !metadata.title || !user || !user.id || !user.username) {
    console.error('[processAO3Job] Missing required fields:', { metadata, user });
    return { error: updateMessages.genericError };
  }

  let recommendation;

  if (isUpdate) {
    // Find existing recommendation by ao3ID
    const existingRec = await Recommendation.findOne({ where: { ao3ID } });
    
    if (!existingRec) {
      console.error('[processAO3Job] Update requested but no existing recommendation found for ao3ID:', ao3ID);
      return { error: updateMessages.genericError };
    }

    // Update with fresh AO3 data
    // ModLocks apply to user edits only — automated AO3 updates bypass them
    const updateFields = await buildUpdateFields(existingRec, metadata, seriesId, notPrimaryWork);
    
    if (Object.keys(updateFields).length > 0) {
      try {
        await existingRec.update(updateFields);
        await existingRec.reload();
      } catch (err) {
        console.error('[processAO3Job] Error updating recommendation:', err);
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
        archive_warnings: Array.isArray(metadata.archiveWarnings) ? metadata.archiveWarnings : [],
        kudos: metadata.kudos,
        hits: metadata.hits,
        bookmarks: metadata.bookmarks,
        comments: metadata.comments,
        category: metadata.category,
        ao3ID,
        fandom_tags: Array.isArray(metadata.fandom_tags) ? metadata.fandom_tags : [],
        relationship_tags: Array.isArray(metadata.relationship_tags) ? metadata.relationship_tags : [],
        character_tags: Array.isArray(metadata.character_tags) ? metadata.character_tags : [],
        category_tags: Array.isArray(metadata.category_tags) ? metadata.category_tags : [],
        freeform_tags: Array.isArray(metadata.freeform_tags) ? metadata.freeform_tags : [],
        ...(seriesId ? { seriesId } : {}),
        notPrimaryWork
      });
    } catch (err) {
      console.error('[processAO3Job] Error creating recommendation:', err);
      return { error: updateMessages.genericError };
    }
  }

  // Generate embed from database record
  const embed = createRecEmbed(recommendation);
  
  return { embed, recommendation };
}

/**
 * Builds update fields object by comparing existing and new metadata
 */
function isUnset(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

async function buildUpdateFields(existingRec, metadata, seriesId, notPrimaryWork) {
  const updateFields = {};
  
  // Check each field for changes
  if (existingRec.title !== metadata.title) {
    updateFields.title = metadata.title;
  }
  
  // Authors comparison
  const newAuthors = metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']);
  const authorsChanged = !Array.isArray(existingRec.authors) || 
    existingRec.authors.length !== newAuthors.length || 
    existingRec.authors.some((a, i) => a !== newAuthors[i]);
  
  if (authorsChanged) {
    updateFields.authors = newAuthors;
    updateFields.author = newAuthors[0] || 'Unknown Author'; // Legacy field
  }
  
  if (existingRec.summary !== metadata.summary) {
    updateFields.summary = metadata.summary;
  }
  
  // Tags comparison
  const newTags = Array.isArray(metadata.tags) ? metadata.tags : [];
  const oldTags = Array.isArray(existingRec.tags) ? existingRec.tags : [];
  if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('tags') : false;
    if (!(locked && !isUnset(oldTags))) updateFields.tags = newTags;
  }
  
  // Basic fields
  {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('rating') : false;
    const lockedAndSet = locked && !isUnset(existingRec.rating);
    if (!lockedAndSet && existingRec.rating !== metadata.rating) updateFields.rating = metadata.rating;
  }
  if (existingRec.wordCount !== metadata.wordCount) updateFields.wordCount = metadata.wordCount;
  if (existingRec.chapters !== metadata.chapters) updateFields.chapters = metadata.chapters;
  {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('status') : false;
    const lockedAndSet = locked && !isUnset(existingRec.status);
    if (!lockedAndSet && existingRec.status !== metadata.status) updateFields.status = metadata.status;
  }
  {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('language') : false;
    const lockedAndSet = locked && !isUnset(existingRec.language);
    if (!lockedAndSet && existingRec.language !== metadata.language) updateFields.language = metadata.language;
  }
  {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('publishedDate') : false;
    const lockedAndSet = locked && !isUnset(existingRec.publishedDate);
    if (!lockedAndSet && existingRec.publishedDate !== metadata.publishedDate) updateFields.publishedDate = metadata.publishedDate;
  }
  {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('updatedDate') : false;
    const lockedAndSet = locked && !isUnset(existingRec.updatedDate);
    if (!lockedAndSet && existingRec.updatedDate !== metadata.updatedDate) updateFields.updatedDate = metadata.updatedDate;
  }
  if (existingRec.kudos !== metadata.kudos) updateFields.kudos = metadata.kudos;
  if (existingRec.hits !== metadata.hits) updateFields.hits = metadata.hits;
  if (existingRec.bookmarks !== metadata.bookmarks) updateFields.bookmarks = metadata.bookmarks;
  if (existingRec.comments !== metadata.comments) updateFields.comments = metadata.comments;
  {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const locked = botsRespect ? await isFieldGloballyModlocked('category') : false;
    const lockedAndSet = locked && !isUnset(existingRec.category);
    if (!lockedAndSet && existingRec.category !== metadata.category) updateFields.category = metadata.category;
  }
  
  // Tag arrays
  const tagFields = ['fandom_tags', 'relationship_tags', 'character_tags', 'category_tags', 'freeform_tags'];
  for (const field of tagFields) {
    const newValue = Array.isArray(metadata[field]) ? metadata[field] : [];
    const oldValue = Array.isArray(existingRec[field]) ? existingRec[field] : [];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const botsRespect = await shouldBotsRespectGlobalModlocks();
      const locked = botsRespect ? await isFieldGloballyModlocked(field) : false;
      if (!(locked && !isUnset(oldValue))) updateFields[field] = newValue;
    }
  }
  
  // Archive warnings
  if (Array.isArray(metadata.archiveWarnings)) {
    const oldWarnings = Array.isArray(existingRec.archive_warnings) ? existingRec.archive_warnings : [];
    if (JSON.stringify(oldWarnings) !== JSON.stringify(metadata.archiveWarnings)) {
      const botsRespect = await shouldBotsRespectGlobalModlocks();
      const locked = botsRespect ? await isFieldGloballyModlocked('archive_warnings') : false;
      if (!(locked && !isUnset(oldWarnings))) updateFields.archive_warnings = metadata.archiveWarnings;
    }
  }
  
  // Series and flags
  if (seriesId && existingRec.seriesId !== seriesId) {
    updateFields.seriesId = seriesId;
  }
  if (existingRec.notPrimaryWork !== notPrimaryWork) {
    updateFields.notPrimaryWork = notPrimaryWork;
  }
  
  return updateFields;
}

export default processAO3Job;