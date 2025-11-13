// Migration: Convert tags, additionalTags, and archive_warnings columns to JSONB

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Convert tags to JSONB
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN tags DROP DEFAULT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN tags TYPE JSONB USING tags::jsonb;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN tags SET DEFAULT '[]';
    `);

    // Convert additionalTags to JSONB
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN "additionalTags" DROP DEFAULT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN "additionalTags" TYPE JSONB USING "additionalTags"::jsonb;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN "additionalTags" SET DEFAULT '[]';
    `);

    // Convert archive_warnings to JSONB
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN archive_warnings DROP DEFAULT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN archive_warnings TYPE JSONB USING archive_warnings::jsonb;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN archive_warnings SET DEFAULT '[]';
    `);
  },
  down: async (queryInterface, Sequelize) => {
    // Revert tags to TEXT
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN tags DROP DEFAULT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN tags TYPE TEXT USING tags::text;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN tags SET DEFAULT '[]';
    `);

    // Revert additionalTags to TEXT
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN "additionalTags" DROP DEFAULT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN "additionalTags" TYPE TEXT USING "additionalTags"::text;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN "additionalTags" SET DEFAULT '[]';
    `);

    // Revert archive_warnings to TEXT
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN archive_warnings DROP DEFAULT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN archive_warnings TYPE TEXT USING archive_warnings::text;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE recommendations
      ALTER COLUMN archive_warnings SET DEFAULT '[]';
    `);
  }
};
