// migration to create ModLocks table
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ModLocks', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      recommendationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Recommendations',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      field: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Field name (e.g. 'title', 'tags', 'ALL' for whole rec)",
      },
      locked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lockLevel: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'mod',
      },
      lockedBy: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'User ID of the locker',
      },
      lockedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      unlockedBy: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'User ID of the unlocker',
      },
      unlockedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    await queryInterface.addIndex('ModLocks', ['recommendationId', 'field']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ModLocks');
  },
};
