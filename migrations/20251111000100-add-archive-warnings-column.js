'use strict';

/**
 * Migration to add archive_warnings column to recommendations table
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('recommendations', 'archive_warnings', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: '[]',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('recommendations', 'archive_warnings');
  }
};
