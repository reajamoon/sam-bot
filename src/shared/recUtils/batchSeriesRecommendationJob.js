// batchSeriesRecommendationJob.js
// Handles batch parsing and storing of AO3 series and all works in the series

import { Recommendation, Series } from '../../models/index.js';
import processRecommendationJob from './processRecommendationJob.js';
import { fetchFicMetadata } from './ficParser.js';

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

  // Determine the true primary work
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
  // 3. Upsert Series entry in DB
  const seriesUpsert = {
    name: seriesMeta.title || seriesMeta.name || 'Untitled Series',
    url: seriesUrl,
    summary: seriesMeta.summary || '',
    ao3SeriesId: seriesMeta.ao3SeriesId || (seriesMeta.url && seriesMeta.url.match(/series\/(\d+)/)?.[1]),
    authors: seriesMeta.authors || [],
    workCount: seriesMeta.workCount || seriesMeta.works.length,
    wordCount: seriesMeta.wordCount || null,
    status: seriesMeta.status || null,
    workIds: Array.isArray(seriesMeta.works) ? seriesMeta.works.map(w => w.url && w.url.match(/works\/(\d+)/)?.[1]).filter(Boolean) : [],
    series_works: Array.isArray(seriesMeta.works) ? seriesMeta.works.map(w => ({ title: w.title, url: w.url, authors: w.authors })) : []
  };
  // Upsert by URL (unique)
  const [seriesRow] = await Series.upsert(seriesUpsert, { returning: true, conflictFields: ['url'] });

  // 4. Store each work as Recommendation, setting notPrimaryWork flag and linking to Series
  const workRecs = [];
  for (let i = 0; i < workMetas.length; i++) {
    const { work, meta } = workMetas[i];
    const isPrimary = i === primaryIdx;
    // Pass all fields from meta (full fic metadata), plus notPrimaryWork flag
    const manualFields = { ...meta, notPrimaryWork: !isPrimary, seriesId: seriesRow.id };
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

  // 5. Optionally notify with the series embed (fetch series rec by primary work)
  if (typeof notify === 'function' && workRecs.length > 0) {
    await notify(workRecs[primaryIdx]);
  }
  return { seriesRec: workRecs[primaryIdx], workRecs };
}


export default batchSeriesRecommendationJob;
