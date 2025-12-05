module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Wordcounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(uuid_generate_v4())'),
        allowNull: false,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      projectId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      sprintId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      countStart: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      countEnd: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      delta: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      recordedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    await queryInterface.addIndex('Wordcounts', ['userId']);
    await queryInterface.addIndex('Wordcounts', ['projectId']);
    await queryInterface.addIndex('Wordcounts', ['recordedAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Wordcounts');
  },
};
