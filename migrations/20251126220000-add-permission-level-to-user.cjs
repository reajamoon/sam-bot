// Migration to add permissionLevel column to User table

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'permissionLevel', {
      type: Sequelize.ENUM('superadmin', 'admin', 'mod', 'member', 'non_member'),
      allowNull: false,
      defaultValue: 'member',
      comment: 'Role-based permission level for mod locking and admin actions.'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'permissionLevel');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_permissionLevel";');
  }
};
