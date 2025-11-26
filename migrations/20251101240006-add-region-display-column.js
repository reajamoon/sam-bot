'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'regionDisplay', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether to display region in profile (true = visible in timezone field or as separate field when timezone hidden)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'regionDisplay');
  }
};