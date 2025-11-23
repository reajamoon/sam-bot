// batchSeriesRecommendationJob.js
// Handles batch parsing and storing of AO3 series and all works in the series

const { Recommendation } = require('../../models');
const processRecommendationJob = require('./processRecommendationJob');
const { fetchFicMetadata } = require('./ficParser');

/**
 * Batch parses an AO3 series and all its works, storing each as a Recommendation.
 * @param {string} seriesUrl - AO3 series URL
 * @param {Object} user - { id, username }
 * @param {Object} options - { additionalTags, notes }
 * @param {Function} [notify] - Optional callback for embed/updates
 * @returns {Promise<{seriesRec: Recommendation, workRecs: Recommendation[]}>}
 */
async function batchSeriesRecommendationJob(seriesUrl, user, options = {}, notify) {
  // 1. Parse the series page to get all work URLs
  const seriesMeta = await fetchFicMetadata(seriesUrl);
  if (!seriesMeta || !seriesMeta.works || !Array.isArray(seriesMeta.works) || seriesMeta.works.length === 0) {
    throw new Error('Failed to parse AO3 series or no works found.');
  }
  // 2. Parse each work and collect metadata for primary detection
  const workMetas = [];
  for (let i = 0; i < seriesMeta.works.length; i++) {
    const work = seriesMeta.works[i];
    const workUrl = work.url;
    // Fetch full metadata for each work (to get tags, post date, etc.)
    const meta = await fetchFicMetadata(workUrl);
    if (!meta) throw new Error(`Failed to fetch metadata for work: ${work.title}`);
    workMetas.push({
      index: i,
      work,
      meta,
      postDate: meta.publishedDate ? new Date(meta.publishedDate) : null,
      hasPrequel: (meta.freeform_tags || []).some(t => /prequel/i.test(t)),
      hasSequel: (meta.freeform_tags || []).some(t => /sequel/i.test(t)),
    });
  }

  // 3. Determine the true primary work
  // Exclude works with prequel/sequel tags from being primary, unless all have them
  let candidates = workMetas.filter(w => !w.hasPrequel && !w.hasSequel);
  if (candidates.length === 0) candidates = workMetas; // fallback: all have prequel/sequel
  // Pick the one with the earliest post date
  let primaryIdx = 0;
  let minDate = null;
  for (const c of candidates) {
    if (c.postDate && (!minDate || c.postDate < minDate)) {
      minDate = c.postDate;
      primaryIdx = c.index;
    }
  }

  // 4. Store each work as Recommendation, setting notPrimaryWork flag
  const workRecs = [];
  for (let i = 0; i < workMetas.length; i++) {
    const { work, meta } = workMetas[i];
    const isPrimary = i === primaryIdx;
    // Pass all fields from meta (full fic metadata), plus notPrimaryWork flag
    const manualFields = { ...meta, notPrimaryWork: !isPrimary };
    const { recommendation: workRec, error } = await processRecommendationJob({
      url: work.url,
      user,
      manualFields,
      additionalTags: options.additionalTags,
      notes: options.notes,
      isUpdate: false,
      notify: null
    });
    if (error) throw new Error(`Failed to process work: ${work.title}`);
    workRecs.push(workRec);
  }
  // 3. Store the series rec itself, referencing all works
  // Pass all available series-level metadata fields for the series rec
  const seriesManualFields = {
    ...seriesMeta,
    works: seriesMeta.works.map(w => ({ title: w.title, url: w.url, authors: w.authors })),
    // Pass through tags, rating, wordCount, summary, authors, etc. if present
    tags: seriesMeta.tags || seriesMeta.freeform_tags || [],
    rating: seriesMeta.rating || 'Not Rated',
    wordCount: seriesMeta.wordCount,
    summary: seriesMeta.summary,
    authors: seriesMeta.authors,
    // Add any other fields you want to ensure are present
  };
  const { recommendation: seriesRec, error: seriesError } = await processRecommendationJob({
    url: seriesUrl,
    user,
    manualFields: seriesManualFields,
    additionalTags: options.additionalTags,
    notes: options.notes,
    isUpdate: false,
    notify: notify || null
  });
  if (seriesError) throw new Error('Failed to process series rec');
  // 4. Optionally notify with the series embed
  if (typeof notify === 'function') {
    await notify(seriesRec);
  }
  return { seriesRec, workRecs };
}

module.exports = batchSeriesRecommendationJob;
