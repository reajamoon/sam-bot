/**
 * Create GuildSprintSettings table to control allowed channels and defaults.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('GuildSprintSettings', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      guildId: { type: DataTypes.STRING, allowNull: false, unique: true },
      allowedChannelIds: { type: DataTypes.JSON, allowNull: true },
      blockedChannelIds: { type: DataTypes.JSON, allowNull: true },
      allowThreadsByDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      defaultSummaryChannelId: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    // No separate non-unique index needed; unique constraint on guildId already creates an index.
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('GuildSprintSettings');
  },
};
