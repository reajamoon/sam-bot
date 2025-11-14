'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Recommendations', 'character_tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
    await queryInterface.addColumn('Recommendations', 'fandom_tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Recommendations', 'character_tags');
    await queryInterface.removeColumn('Recommendations', 'fandom_tags');
  }
};
