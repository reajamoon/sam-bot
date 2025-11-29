// processFicJob.js
// General implementation for processing non-AO3 fanfiction metadata (used by queue worker)
// Supports FFNet, Wattpad, LiveJournal, Dreamwidth, Tumblr
// User metadata (notes, manual fields) is handled separately by command handlers

import { Recommendation } from '../../models/index.js';
import { fetchFicMetadata } from './ficParser.js';
import { createRecommendationEmbed } from './asyncEmbeds.js';
import updateMessages from '../text/updateMessages.js';

/**
 * Processes non-AO3 fanfiction recommendation data from queue worker.
 * This function ONLY handles site metadata - user metadata is handled separately.
 * @param {Object} payload - Job payload from queue
 * @param {string} payload.url - Fanfiction URL
 * @param {Object} payload.user - User context (id, username)
 * @param {boolean} [payload.isUpdate] - Whether updating existing recommendation
 * @param {string} [payload.site] - Site type: 'ffnet', 'wattpad', 'livejournal', 'dreamwidth', 'tumblr'
 * @returns {Promise<{embed: Object, recommendation: Recommendation, error?: string}>}
 */
async function processFicJob(payload) {
  const {
    url,
    user,
    isUpdate = false,
    site = 'other'
  } = payload;

  // Fetch metadata from the fanfiction site
  let metadata;
  try {
    metadata = await fetchFicMetadata(url);
    
    // Unwrap { metadata } if present
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
  } catch (err) {
    console.error('[processFicJob] Error fetching metadata:', err);
    return { error: updateMessages.genericError };
  }

  if (!metadata) {
    console.error('[processFicJob] Metadata fetch returned null for URL:', url);
    return { error: updateMessages.genericError };
  }

  // Handle site-specific errors
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

  // Normalize metadata (ficParser.js already normalizes, but ensure it's done)
  const normalizeMetadataModule = await import('./normalizeMetadata.js');
  const normalizeMetadata = normalizeMetadataModule.default || normalizeMetadataModule;
  metadata = normalizeMetadata(metadata, site);

  // Ensure required fields
  if (!metadata || !metadata.title || !user || !user.id || !user.username) {
    console.error('[processFicJob] Missing required fields:', { metadata, user });
    return { error: updateMessages.genericError };
  }

  let recommendation;

  if (isUpdate) {
    // Find existing recommendation by URL
    const existingRec = await Recommendation.findOne({ where: { url } });
    
    if (!existingRec) {
      console.error('[processFicJob] Update requested but no existing recommendation found for URL:', url);
      return { error: updateMessages.genericError };
    }

    // Update with fresh metadata
    const updateFields = buildUpdateFields(existingRec, metadata);
    
    if (Object.keys(updateFields).length > 0) {
      try {
        await existingRec.update(updateFields);
        await existingRec.reload();
      } catch (err) {
        console.error('[processFicJob] Error updating recommendation:', err);
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
        // Don't set ao3ID for non-AO3 sites
        fandom_tags: Array.isArray(metadata.fandom_tags) ? metadata.fandom_tags : [],
        relationship_tags: Array.isArray(metadata.relationship_tags) ? metadata.relationship_tags : [],
        character_tags: Array.isArray(metadata.character_tags) ? metadata.character_tags : [],
        category_tags: Array.isArray(metadata.category_tags) ? metadata.category_tags : [],
        freeform_tags: Array.isArray(metadata.freeform_tags) ? metadata.freeform_tags : []
      });
    } catch (err) {
      console.error('[processFicJob] Error creating recommendation:', err);
      return { error: updateMessages.genericError };
    }
  }

  // Generate embed from database record
  const embed = await createRecommendationEmbed(recommendation);
  
  return { embed, recommendation };
}

/**
 * Builds update fields object by comparing existing and new metadata
 */
function buildUpdateFields(existingRec, metadata) {
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
    updateFields.tags = newTags;
  }
  
  // Basic fields
  if (existingRec.rating !== metadata.rating) updateFields.rating = metadata.rating;
  if (existingRec.wordCount !== metadata.wordCount) updateFields.wordCount = metadata.wordCount;
  if (existingRec.chapters !== metadata.chapters) updateFields.chapters = metadata.chapters;
  if (existingRec.status !== metadata.status) updateFields.status = metadata.status;
  if (existingRec.language !== metadata.language) updateFields.language = metadata.language;
  if (existingRec.publishedDate !== metadata.publishedDate) updateFields.publishedDate = metadata.publishedDate;
  if (existingRec.updatedDate !== metadata.updatedDate) updateFields.updatedDate = metadata.updatedDate;
  if (existingRec.kudos !== metadata.kudos) updateFields.kudos = metadata.kudos;
  if (existingRec.hits !== metadata.hits) updateFields.hits = metadata.hits;
  if (existingRec.bookmarks !== metadata.bookmarks) updateFields.bookmarks = metadata.bookmarks;
  if (existingRec.comments !== metadata.comments) updateFields.comments = metadata.comments;
  if (existingRec.category !== metadata.category) updateFields.category = metadata.category;
  
  // Tag arrays (may be sparse for non-AO3 sites)
  const tagFields = ['fandom_tags', 'relationship_tags', 'character_tags', 'category_tags', 'freeform_tags'];
  tagFields.forEach(field => {
    const newValue = Array.isArray(metadata[field]) ? metadata[field] : [];
    const oldValue = Array.isArray(existingRec[field]) ? existingRec[field] : [];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      updateFields[field] = newValue;
    }
  });
  
  // Archive warnings
  if (Array.isArray(metadata.archiveWarnings)) {
    const oldWarnings = Array.isArray(existingRec.archive_warnings) ? existingRec.archive_warnings : [];
    if (JSON.stringify(oldWarnings) !== JSON.stringify(metadata.archiveWarnings)) {
      updateFields.archive_warnings = metadata.archiveWarnings;
    }
  }
  
  return updateFields;
}

export default processFicJob;