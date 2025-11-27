// Utility to fetch a Series with its works and user metadata
import { Series, Recommendation, UserFicMetadata } from './index.js';
import { Op } from 'sequelize';

/**
 * Fetch a series by ID, including its works and user metadata.
 * @param {number} seriesId - The series ID
 * @returns {Promise<Series>} The series with .works and .userMetadata
 */
export async function fetchSeriesWithUserMetadata(seriesId) {
  const include = [
    {
      model: Recommendation,
      as: 'works',
      order: [['part', 'ASC']]
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
      required: false // LEFT JOIN to include series even without user metadata
    }
  ];
  return Series.findByPk(seriesId, { include });
}