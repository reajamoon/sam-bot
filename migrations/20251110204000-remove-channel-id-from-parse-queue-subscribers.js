// Migration to remove channel_id from ParseQueueSubscribers
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ParseQueueSubscribers', 'channel_id');
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ParseQueueSubscribers', 'channel_id', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Channel to notify when fic parsing is complete'
    });
  }
};
