
// Utility to fetch a Recommendation with its Series info (and optionally all works in the series)
import { Recommendation, Series, UserFicMetadata } from './index.js';
import { Op } from 'sequelize';
import { Op } from 'sequelize';

/**
 * Fetch a recommendation by ID, including its series info (if any).
 * Optionally, fetch all works in the series (ordered by part).
 * Also includes user metadata (notes) for all users who have added notes.
 * @param {number} recId - The recommendation (work) ID
 * @param {boolean} includeSeriesWorks - If true, also include all works in the series
 * @returns {Promise<Recommendation>} The recommendation with .series, .userMetadata (and .series.works if requested)
 */
export async function fetchRecWithSeries(recId, includeSeriesWorks = false) {
  const include = [
    {
      model: Series,
      as: 'series',
      ...(includeSeriesWorks
        ? { include: [{ model: Recommendation, as: 'works', order: [['part', 'ASC']] }] }
        : {})
    },
    {
      model: UserFicMetadata,
      as: 'userMetadata',
      where: {
        [Op.or]: [
          { rec_note: { [Op.not]: null } },
          { additional_tags: { [Op.not]: null } }
        ]
      },
      required: false // LEFT JOIN to include recs even without notes/tags
    }
  ];
  return Recommendation.findByPk(recId, { include });
}
