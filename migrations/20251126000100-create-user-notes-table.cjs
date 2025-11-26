// Migration to create user_notes table for per-user fic notes
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_fic_metadata', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ao3ID: {
        type: Sequelize.INTEGER,
        allowNull: true, // Now nullable for series recs
      },
      manual_title: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      manual_authors: {
        type: Sequelize.JSONB, // Array of author names
        allowNull: true,
        defaultValue: null,
      },
      manual_summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      manual_tags: {
        type: Sequelize.JSONB, // Array of tags
        allowNull: true,
        defaultValue: [],
      },
      manual_rating: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      manual_wordcount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      manual_chapters: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      manual_status: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      manual_archive_warnings: {
        type: Sequelize.JSONB, // Array of warnings
        allowNull: true,
        defaultValue: [],
      },
      manual_seriesName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      manual_seriesPart: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      manual_seriesUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      seriesId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      additional_tags: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      rec_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addConstraint('user_fic_metadata', {
      fields: ['userID', 'ao3ID', 'seriesId'],
      type: 'unique',
      name: 'unique_user_fic_metadata_entry'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_fic_metadata');
  }
};
