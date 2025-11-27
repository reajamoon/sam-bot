// Migration to add validation_reason to ParseQueue
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ParseQueue', 'validation_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ParseQueue', 'validation_reason');
  },
};
