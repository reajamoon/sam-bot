// Migration: Add authors array field to recommendations and migrate existing author data
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add the new authors field (JSONB array)
    await queryInterface.addColumn('recommendations', 'authors', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
    // 2. Migrate existing author data to authors array (as JSONB)
    await queryInterface.sequelize.query(`
      UPDATE recommendations
      SET authors =
        CASE
          WHEN author IS NOT NULL AND author != ''
            THEN jsonb_build_array(author)
          ELSE NULL
        END
    `);
  },
  down: async (queryInterface, Sequelize) => {
  // Remove the authors field
  await queryInterface.removeColumn('recommendations', 'authors');
  }
};
