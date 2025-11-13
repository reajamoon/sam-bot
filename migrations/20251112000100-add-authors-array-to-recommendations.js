// Migration: Add authors array field to recommendations and migrate existing author data
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add the new authors field (TEXT, JSON array)
    await queryInterface.addColumn('recommendations', 'authors', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
    // 2. Migrate existing author data to authors array
    await queryInterface.sequelize.query(`
      UPDATE recommendations
      SET authors =
        CASE
          WHEN author IS NOT NULL AND author != ''
            THEN json('[' || quote(author) || ']')
          ELSE NULL
        END
    `);
  },
  down: async (queryInterface, Sequelize) => {
    // Remove the authors field
    await queryInterface.removeColumn('recommendations', 'authors');
  }
};
