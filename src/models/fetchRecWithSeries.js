
// Utility to fetch a Recommendation with its Series info (and optionally all works in the series)
import { Recommendation, Series } from './index.js';

/**
 * Fetch a recommendation by ID, including its series info (if any).
 * Optionally, fetch all works in the series (ordered by part).
 * @param {number} recId - The recommendation (work) ID
 * @param {boolean} includeSeriesWorks - If true, also include all works in the series
 * @returns {Promise<Recommendation>} The recommendation with .series (and .series.works if requested)
 */
export async function fetchRecWithSeries(recId, includeSeriesWorks = false) {
  const include = [
    {
      model: Series,
      as: 'series',
      ...(includeSeriesWorks
        ? { include: [{ model: Recommendation, as: 'works', order: [['part', 'ASC']] }] }
        : {})
    }
  ];
  return Recommendation.findByPk(recId, { include });
}
