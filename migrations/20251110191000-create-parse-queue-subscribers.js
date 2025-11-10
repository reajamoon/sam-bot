// Migration for ParseQueueSubscribers table
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ParseQueueSubscribers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      queue_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ParseQueue',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ParseQueueSubscribers');
  },
};
