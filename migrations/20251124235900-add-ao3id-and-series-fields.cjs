// Migration: Add AO3 ID, authors, workCount, wordCount columns to series; ao3ID to recommendations

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add ao3ID to recommendations (works)
    await queryInterface.addColumn('recommendations', 'ao3ID', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      comment: 'AO3 work ID parsed from URL'
    });
    // Add seriesID, authors, workCount, wordCount to series
    await queryInterface.addColumn('series', 'ao3SeriesId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      comment: 'AO3 series ID parsed from URL'
    });
    await queryInterface.addColumn('series', 'authors', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Array of author names for the series'
    });
    await queryInterface.addColumn('series', 'workCount', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Number of works in the series (AO3)'
    });
    await queryInterface.addColumn('series', 'wordCount', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Total word count for the series (AO3)'
    });
    await queryInterface.addColumn('series', 'status', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Completion status for the series (AO3)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('recommendations', 'ao3ID');
    await queryInterface.removeColumn('series', 'ao3SeriesId');
    await queryInterface.removeColumn('series', 'authors');
    await queryInterface.removeColumn('series', 'workCount');
    await queryInterface.removeColumn('series', 'wordCount');
    await queryInterface.removeColumn('series', 'status');
  }
};
