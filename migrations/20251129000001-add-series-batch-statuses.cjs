'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add batch_type field for different processing types
    await queryInterface.addColumn('parsequeue', 'batch_type', {
      type: Sequelize.ENUM('series'),
      allowNull: true,
      comment: 'Type of batch processing: series for series URLs'
    });
    
    // Check if the enum type exists, if not create it, then add series-done status
    const [enumExists] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_parsequeue_status'
      );
    `);
    
    if (enumExists[0].exists) {
      // Add series-done to existing enum
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_parsequeue_status" ADD VALUE 'series-done';
      `);
    } else {
      // Get current status column info and recreate with new value
      await queryInterface.sequelize.query(`
        ALTER TABLE "parsequeue" 
        ALTER COLUMN "status" TYPE TEXT;
      `);
      
      await queryInterface.changeColumn('parsequeue', 'status', {
        type: Sequelize.ENUM('pending', 'processing', 'done', 'error', 'nOTP', 'series-done'),
        allowNull: false,
        defaultValue: 'pending',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('parsequeue', 'batch_type');
    // Note: PostgreSQL doesn't support removing enum values easily
    console.log('WARNING: Cannot easily remove enum values in PostgreSQL');
    console.log('Manual intervention required to remove series-done status');
  }
};