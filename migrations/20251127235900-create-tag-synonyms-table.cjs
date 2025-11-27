'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create tag_synonyms table for flexible tag matching
    await queryInterface.createTable('tag_synonyms', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      search_term: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'The term users will search for (e.g. "hurt!dean", "AU", "coffee shop")'
      },
      canonical_tags: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Array of canonical tags that match this search term'
      },
      category: {
        type: Sequelize.ENUM('bang_tag', 'au_variant', 'general', 'ao3_synonym'),
        allowNull: false,
        defaultValue: 'general',
        comment: 'Type of synonym mapping'
      },
      source: {
        type: Sequelize.ENUM('manual', 'ao3_scrape', 'community'),
        allowNull: false,
        defaultValue: 'manual',
        comment: 'Where this mapping came from'
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Priority for relevance ranking (higher = more relevant)'
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 1.0,
        comment: 'Confidence score 0.0-1.0 for mapping accuracy'
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this mapping is currently active'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Create indexes for efficient lookups
    await queryInterface.addIndex('tag_synonyms', ['search_term'], {
      name: 'idx_tag_synonyms_search_term'
    });
    
    await queryInterface.addIndex('tag_synonyms', ['category'], {
      name: 'idx_tag_synonyms_category'
    });
    
    await queryInterface.addIndex('tag_synonyms', ['source'], {
      name: 'idx_tag_synonyms_source'
    });
    
    await queryInterface.addIndex('tag_synonyms', ['active'], {
      name: 'idx_tag_synonyms_active'
    });

    // Insert initial AU synonym data (migrating from hardcoded logic)
    await queryInterface.bulkInsert('tag_synonyms', [
      {
        search_term: 'AU',
        canonical_tags: JSON.stringify(['AU', 'Alternate Universe']),
        category: 'au_variant',
        source: 'manual',
        priority: 5,
        confidence: 1.0
      },
      {
        search_term: 'Alternate Universe',
        canonical_tags: JSON.stringify(['AU', 'Alternate Universe']),
        category: 'au_variant', 
        source: 'manual',
        priority: 5,
        confidence: 1.0
      },
      // Common bang tag examples for Destiel fandom
      {
        search_term: 'hurt!dean',
        canonical_tags: JSON.stringify(['Hurt Dean Winchester', 'Injured Dean Winchester', 'Dean Winchester Whump', 'Hurt Dean']),
        category: 'bang_tag',
        source: 'manual',
        priority: 4,
        confidence: 0.9
      },
      {
        search_term: 'protective!castiel',
        canonical_tags: JSON.stringify(['Protective Castiel', 'Castiel Protects Dean Winchester', 'Protective Cas']),
        category: 'bang_tag',
        source: 'manual',
        priority: 4,
        confidence: 0.9
      },
      {
        search_term: 'protective!cas',
        canonical_tags: JSON.stringify(['Protective Castiel', 'Castiel Protects Dean Winchester', 'Protective Cas']),
        category: 'bang_tag',
        source: 'manual',
        priority: 4,
        confidence: 0.9
      },
      {
        search_term: 'jealous!dean',
        canonical_tags: JSON.stringify(['Jealous Dean Winchester', 'Dean Winchester is Jealous', 'Jealous Dean']),
        category: 'bang_tag',
        source: 'manual',
        priority: 4,
        confidence: 0.9
      },
      {
        search_term: 'bottom!dean',
        canonical_tags: JSON.stringify(['Bottom Dean Winchester', 'Bottom Dean']),
        category: 'bang_tag',
        source: 'manual',
        priority: 4,
        confidence: 0.9
      },
      {
        search_term: 'top!castiel',
        canonical_tags: JSON.stringify(['Top Castiel', 'Top Cas']),
        category: 'bang_tag',
        source: 'manual',
        priority: 4,
        confidence: 0.9
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('tag_synonyms');
  }
};