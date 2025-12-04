"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add bot_name and ticket_number columns
    await queryInterface.addColumn('ModmailRelay', 'bot_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('ModmailRelay', 'ticket_number', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add indexes to support lookups
    await queryInterface.addIndex('ModmailRelay', ['bot_name'], { unique: false, name: 'modmailrelay_bot_name_idx' });
    await queryInterface.addIndex('ModmailRelay', ['user_id', 'bot_name', 'open'], { unique: false, name: 'modmailrelay_user_bot_open_idx' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('ModmailRelay', 'modmailrelay_user_bot_open_idx');
    await queryInterface.removeIndex('ModmailRelay', 'modmailrelay_bot_name_idx');
    await queryInterface.removeColumn('ModmailRelay', 'ticket_number');
    await queryInterface.removeColumn('ModmailRelay', 'bot_name');
  }
};
