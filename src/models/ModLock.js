// src/models/ModLock.js
import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class ModLock extends Model {
    static associate(models) {
      ModLock.belongsTo(models.Recommendation, {
        foreignKey: 'recommendationId',
        as: 'recommendation',
        onDelete: 'CASCADE',
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
    recommendationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Recommendations',
        key: 'id',
      },
      onDelete: 'CASCADE',
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
    unlockedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User ID of the unlocker',
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'ModLock',
    tableName: 'ModLocks',
    indexes: [
      { fields: ['recommendationId', 'field'] },
    ],
  });
  return ModLock;
};
