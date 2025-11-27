// Migration to create ModmailRelay table
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ModmailRelay', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      fic_url: {
        type: Sequelize.STRING,
        allowNull: false
      },
      thread_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_relayed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('ModmailRelay', ['user_id', 'fic_url']);
    await queryInterface.addIndex('ModmailRelay', ['thread_id']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ModmailRelay');
  }
};
