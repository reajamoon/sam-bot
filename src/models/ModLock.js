// src/models/ModLock.js
import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class ModLock extends Model {
    static associate(models) {
      // Associate ao3ID to Recommendations table
      ModLock.belongsTo(models.Recommendation, {
        foreignKey: 'ao3ID',
        targetKey: 'ao3ID',
        as: 'recommendation',
        constraints: false
      });
      // Associate seriesId to Series table
      ModLock.belongsTo(models.Series, {
        foreignKey: 'seriesId',
        targetKey: 'ao3SeriesId',
        as: 'series',
        constraints: false
      });
      // Associate lockedBy and unlockedBy to User (discordId)
      ModLock.belongsTo(models.User, {
        foreignKey: 'lockedBy',
        targetKey: 'discordId',
        as: 'locker',
        constraints: false
      });
      ModLock.belongsTo(models.User, {
        foreignKey: 'unlockedBy',
        targetKey: 'discordId',
        as: 'unlocker',
        constraints: false
      });
    }
  }
  ModLock.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ao3ID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'AO3 Work ID for work-based locks',
    },
    seriesId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'AO3 Series ID for series-based locks',
    },
    field: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Field name (e.g. 'title', 'tags', 'ALL' for whole rec)",
    },
    locked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lockLevel: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'mod', // 'mod', 'admin', 'superadmin'
    },
    lockedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'User ID of the locker',
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName: 'ModLock',
    tableName: 'modlocks',
    indexes: [
      { fields: ['ao3ID', 'field'] },
      { fields: ['seriesId', 'field'] },
    ],
  });
  return ModLock;
};
