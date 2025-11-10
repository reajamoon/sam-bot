const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Config = sequelize.define('Config', {
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    timestamps: false,
    tableName: 'Config',
  });

  return Config;
};
