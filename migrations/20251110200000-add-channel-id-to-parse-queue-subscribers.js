// Migration to add channel_id to ParseQueueSubscribers
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ParseQueueSubscribers', 'channel_id', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Channel to notify when fic parsing is complete'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ParseQueueSubscribers', 'channel_id');
  }
};
