/**
 * Add team fields to DeanSprints for hosted team sprints.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.addColumn('DeanSprints', 'groupId', { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn('DeanSprints', 'hostId', { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn('DeanSprints', 'role', { type: DataTypes.STRING, allowNull: false, defaultValue: 'participant' });
    await queryInterface.addIndex('DeanSprints', ['groupId']);
    await queryInterface.addIndex('DeanSprints', ['hostId']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('DeanSprints', ['groupId']).catch(() => {});
    await queryInterface.removeIndex('DeanSprints', ['hostId']).catch(() => {});
    await queryInterface.removeColumn('DeanSprints', 'groupId').catch(() => {});
    await queryInterface.removeColumn('DeanSprints', 'hostId').catch(() => {});
    await queryInterface.removeColumn('DeanSprints', 'role').catch(() => {});
  },
};
