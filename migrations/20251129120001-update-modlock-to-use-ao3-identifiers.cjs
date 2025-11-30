'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the new ao3ID and seriesId columns
    await queryInterface.addColumn('modlocks', 'ao3ID', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'AO3 Work ID for work-based locks'
    });

    await queryInterface.addColumn('modlocks', 'seriesId', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'AO3 Series ID for series-based locks'
    });

    // Migrate existing data: populate ao3ID from recommendationId relationships
    await queryInterface.sequelize.query(`
      UPDATE modlocks
      SET "ao3ID" = (
        SELECT r."ao3ID"
        FROM recommendations r
        WHERE r.id = modlocks."recommendationId"
      )
      WHERE "recommendationId" IS NOT NULL
    `);

    // Migrate existing data: populate seriesId from recommendationId relationships
    await queryInterface.sequelize.query(`
      UPDATE modlocks
      SET "seriesId" = (
        SELECT s."ao3SeriesId"
        FROM series s
        JOIN recommendations r ON r."seriesId" = s.id
        WHERE r.id = modlocks."recommendationId"
      )
      WHERE "recommendationId" IS NOT NULL
    `);

    // Remove the old recommendationId column and its foreign key constraint
    await queryInterface.removeColumn('modlocks', 'recommendationId');
  },

  async down(queryInterface, Sequelize) {
    // Re-add the recommendationId column
    await queryInterface.addColumn('modlocks', 'recommendationId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'recommendations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });

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
    `);

    // Remove the new columns
    await queryInterface.removeColumn('modlocks', 'ao3ID');
    await queryInterface.removeColumn('modlocks', 'seriesId');
  }
};