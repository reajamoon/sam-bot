'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add batch_type field for different processing types
    await queryInterface.addColumn('ParseQueue', 'batch_type', {
      type: Sequelize.ENUM('series'),
      allowNull: true,
      comment: 'Type of batch processing: series for series URLs'
    });
    
    // Add series-done status for batch series completion
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_ParseQueues_status" ADD VALUE 'series-done';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ParseQueue', 'batch_type');
    // Note: PostgreSQL doesn't support removing enum values easily
    console.log('WARNING: Cannot easily remove enum values in PostgreSQL');
    console.log('Manual intervention required to remove series-done status');
  }
};