// 20251111235900-add-queue-notify-tag-column.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'queueNotifyTag', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether to tag the user in fic queue notifications (true = tag, false = no tag)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'queueNotifyTag');
  }
};
