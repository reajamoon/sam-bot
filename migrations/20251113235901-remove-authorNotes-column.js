// Migration to remove authorNotes column from recommendations table
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the column if it exists
    await queryInterface.removeColumn('recommendations', 'authorNotes');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the column if needed (for rollback)
    await queryInterface.addColumn('recommendations', 'authorNotes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  }
};
