// 20251124190000-add-workids-to-series.js
// Migration: Add workIds JSONB field to Series table

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('series', 'workIds', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Array of AO3 work IDs for all works in the series (not all may be imported)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('series', 'workIds');
  }
};
