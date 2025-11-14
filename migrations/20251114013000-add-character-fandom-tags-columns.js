'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
  await queryInterface.addColumn('recommendations', 'character_tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
  await queryInterface.addColumn('recommendations', 'fandom_tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
  await queryInterface.removeColumn('recommendations', 'character_tags');
  await queryInterface.removeColumn('recommendations', 'fandom_tags');
  }
};
