
// Utility to check if a fetched AO3 work is part of a series
export function isPartOfSeries(metadata) {
  // AO3 metadata should have a 'series' field if part of a series
  return metadata && Array.isArray(metadata.series) && metadata.series.length > 0;
}

/**
 * Given an array of AO3 works in a series, returns an array of objects:
 *   { work, notPrimaryWork: boolean }
 * Only the primary work (see logic) gets notPrimaryWork: false, all others true.
 * @param {Array} works - Array of AO3 work objects (must have url, tags/freeform_tags, publishedDate)
 * @returns {Array<{work: Object, notPrimaryWork: boolean, isPrimary: boolean}>}
 */
export function markPrimaryAndNotPrimaryWorks(works) {
  if (!Array.isArray(works) || works.length === 0) return [];
  let workMetas = works.map((w, i) => ({
    ...w,
    index: i,
    hasPrequel: (w.tags || w.freeform_tags || []).some(t => /prequel/i.test(t)),
    hasSequel: (w.tags || w.freeform_tags || []).some(t => /sequel/i.test(t)),
    postDate: w.publishedDate ? new Date(w.publishedDate) : null
  }));
  let candidates = workMetas.filter(w => !w.hasPrequel && !w.hasSequel);
  if (candidates.length === 0) candidates = workMetas;
  let primaryWork = candidates[0];
  for (const c of candidates) {
    if (c.postDate && (!primaryWork.postDate || c.postDate < primaryWork.postDate)) {
      primaryWork = c;
    }
  }
  return workMetas.map(w => ({
    work: w,
    notPrimaryWork: w.index !== primaryWork.index,
    isPrimary: w.index === primaryWork.index
  }));
}
