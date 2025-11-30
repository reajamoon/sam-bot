'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if columns already exist before adding them
      const tableDesc = await queryInterface.describeTable('modlocks');
      
      // Add the new ao3ID column if it doesn't exist, or change its type if it does
      if (!tableDesc.ao3ID) {
        await queryInterface.addColumn('modlocks', 'ao3ID', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'AO3 Work ID for work-based locks'
        }, { transaction });
      } else if (tableDesc.ao3ID.type.includes('varchar') || tableDesc.ao3ID.type.includes('text')) {
        // Column exists but is wrong type (STRING), change it to INTEGER
        await queryInterface.changeColumn('modlocks', 'ao3ID', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'AO3 Work ID for work-based locks'
        }, { transaction });
      }

      // Add the new seriesId column if it doesn't exist, or change its type if it does
      if (!tableDesc.seriesId) {
        await queryInterface.addColumn('modlocks', 'seriesId', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'AO3 Series ID for series-based locks'
        }, { transaction });
      } else if (tableDesc.seriesId.type.includes('varchar') || tableDesc.seriesId.type.includes('text')) {
        // Column exists but is wrong type (STRING), change it to INTEGER
        await queryInterface.changeColumn('modlocks', 'seriesId', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'AO3 Series ID for series-based locks'
        }, { transaction });
      }

      // Only migrate data if recommendationId column still exists
      if (tableDesc.recommendationId) {
        // Migrate existing data: populate ao3ID from recommendationId relationships
        await queryInterface.sequelize.query(`
          UPDATE modlocks
          SET "ao3ID" = (
            SELECT r."ao3ID"
            FROM recommendations r
            WHERE r.id = modlocks."recommendationId"
          )
          WHERE "recommendationId" IS NOT NULL AND "ao3ID" IS NULL
        `, { transaction });

        // Migrate existing data: populate seriesId from recommendationId relationships
        await queryInterface.sequelize.query(`
          UPDATE modlocks
          SET "seriesId" = (
            SELECT s."ao3SeriesId"
            FROM series s
            JOIN recommendations r ON r."seriesId" = s.id
            WHERE r.id = modlocks."recommendationId"
          )
          WHERE "recommendationId" IS NOT NULL AND "seriesId" IS NULL
        `, { transaction });

        // Remove the old recommendationId column and its foreign key constraint
        await queryInterface.removeColumn('modlocks', 'recommendationId', { transaction });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const tableDesc = await queryInterface.describeTable('modlocks');

      // Re-add the recommendationId column if it doesn't exist
      if (!tableDesc.recommendationId) {
        await queryInterface.addColumn('modlocks', 'recommendationId', {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'recommendations',
            key: 'id',
          },
          onDelete: 'CASCADE',
        }, { transaction });

        // Try to migrate data back (may lose some data if recommendations were deleted)
        await queryInterface.sequelize.query(`
          UPDATE modlocks
          SET "recommendationId" = (
            SELECT r.id
            FROM recommendations r
            WHERE r."ao3ID" = modlocks."ao3ID"
            LIMIT 1
          )
          WHERE "ao3ID" IS NOT NULL
        `, { transaction });
      }

      // Remove the new columns if they exist
      if (tableDesc.ao3ID) {
        await queryInterface.removeColumn('modlocks', 'ao3ID', { transaction });
      }
      if (tableDesc.seriesId) {
        await queryInterface.removeColumn('modlocks', 'seriesId', { transaction });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};