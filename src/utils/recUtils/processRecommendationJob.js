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
  if (manualFields.title && manualFields.author) {
    metadata = {
      title: manualFields.title,
      authors: [manualFields.author],
      summary: manualFields.summary || 'Manually added recommendation',
      tags: [],
      rating: manualFields.rating || 'Not Rated',
      language: 'English',
      wordCount: manualFields.wordCount,
      url
    };
  } else {
    metadata = await fetchFicMetadata(url);
    if (metadata && metadata.url) metadata.url = normalizeAO3Url(metadata.url);
    if (!metadata) return { error: 'Could not fetch details from that URL.' };
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
    if (manualFields.title) metadata.title = manualFields.title;
    if (manualFields.author) metadata.authors = [manualFields.author];
    if (manualFields.summary) metadata.summary = manualFields.summary;
    if (manualFields.wordCount) metadata.wordCount = manualFields.wordCount;
    if (manualFields.rating) metadata.rating = manualFields.rating;
  }

  let recommendation;
  if (isUpdate && existingRec) {
    // Update existing recommendation
    await existingRec.update({
      url,
      title: metadata.title,
      author: (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author',
      summary: metadata.summary,
      tags: JSON.stringify(metadata.tags || []),
      rating: metadata.rating,
      wordCount: metadata.wordCount,
      chapters: metadata.chapters,
      status: metadata.status,
      language: metadata.language,
      publishedDate: metadata.publishedDate,
      updatedDate: metadata.updatedDate,
      recommendedBy: user.id,
      recommendedByUsername: user.username,
      additionalTags: JSON.stringify(additionalTags),
      notes: notes,
      kudos: metadata.kudos,
      hits: metadata.hits,
      bookmarks: metadata.bookmarks,
      comments: metadata.comments,
      category: metadata.category
    });
    await existingRec.reload();
    recommendation = existingRec;
  } else {
    // Create new recommendation
    recommendation = await Recommendation.create({
      url,
      title: metadata.title,
      author: (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author',
      summary: metadata.summary,
      tags: JSON.stringify(metadata.tags || []),
      rating: metadata.rating,
      wordCount: metadata.wordCount,
      chapters: metadata.chapters,
      status: metadata.status,
      language: metadata.language,
      publishedDate: metadata.publishedDate,
      updatedDate: metadata.updatedDate,
      recommendedBy: user.id,
      recommendedByUsername: user.username,
      additionalTags: JSON.stringify(additionalTags),
      notes: notes,
      kudos: metadata.kudos,
      hits: metadata.hits,
      bookmarks: metadata.bookmarks,
      comments: metadata.comments,
      category: metadata.category
    });
  }

  // Build recForEmbed
  const recForEmbed = {
    ...metadata,
    authors: metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']),
    url,
    id: recommendation.id,
    recommendedByUsername: user.username,
    notes,
    getParsedTags: function() {
      if (Array.isArray(additionalTags) && additionalTags.length > 0) return additionalTags;
      if (Array.isArray(this.tags)) return this.tags;
      if (typeof this.tags === 'string') {
        try {
          const parsed = JSON.parse(this.tags);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
      return [];
    }
  };
  const embed = await createRecommendationEmbed(recForEmbed);
  if (typeof notify === 'function') {
    await notify(embed, recommendation, metadata);
  }
  return { embed, recommendation };
}

module.exports = processRecommendationJob;
