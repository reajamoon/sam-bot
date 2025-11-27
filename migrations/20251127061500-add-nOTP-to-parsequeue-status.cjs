// Migration to add 'nOTP' to the ParseQueue.status enum
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'nOTP' to the enum type for status
    await queryInterface.sequelize.query(`ALTER TYPE "enum_ParseQueue_status" ADD VALUE IF NOT EXISTS 'nOTP';`);
  },
  down: async (queryInterface, Sequelize) => {
    // No easy way to remove a value from a Postgres enum; document as irreversible
    // Optionally, you could recreate the enum without 'nOTP', but that's risky in production
  }
};
