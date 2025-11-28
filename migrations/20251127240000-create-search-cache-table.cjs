'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create search_cache table for persistent search query caching
    await queryInterface.createTable('search_cache', {
      query_id: {
        type: Sequelize.STRING(8),
        primaryKey: true,
        allowNull: false,
        comment: 'Short hash of the search query for button IDs'
      },
      query_data: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'The complete search query parameters object'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this cache entry expires'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Index for efficient expiration cleanup
    await queryInterface.addIndex('search_cache', ['expires_at'], {
      name: 'idx_search_cache_expires_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('search_cache');
  }
};