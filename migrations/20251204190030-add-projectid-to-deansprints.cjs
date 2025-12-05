module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('DeanSprints', 'projectId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addIndex('DeanSprints', ['projectId']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('DeanSprints', ['projectId']);
    await queryInterface.removeColumn('DeanSprints', 'projectId');
  },
};
