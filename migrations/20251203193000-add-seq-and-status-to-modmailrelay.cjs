"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ModmailRelay', 'ticket_seq', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('ModmailRelay', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'open',
    });
    await queryInterface.addColumn('ModmailRelay', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    });
    await queryInterface.addColumn('ModmailRelay', 'closed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('ModmailRelay', ['ticket_number'], { unique: false, name: 'modmailrelay_ticket_number_idx' });
    await queryInterface.addIndex('ModmailRelay', ['bot_name', 'ticket_seq'], { unique: true, name: 'modmailrelay_bot_ticketseq_unique' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('ModmailRelay', 'modmailrelay_bot_ticketseq_unique');
    await queryInterface.removeIndex('ModmailRelay', 'modmailrelay_ticket_number_idx');
    await queryInterface.removeColumn('ModmailRelay', 'closed_at');
    await queryInterface.removeColumn('ModmailRelay', 'created_at');
    await queryInterface.removeColumn('ModmailRelay', 'status');
    await queryInterface.removeColumn('ModmailRelay', 'ticket_seq');
  }
};
