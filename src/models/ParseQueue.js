const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ParseQueue = sequelize.define('ParseQueue', {
    fic_url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'done', 'error'),
      allowNull: false,
      defaultValue: 'pending',
    },
    requested_by: {
      type: DataTypes.STRING, // Comma-separated Discord user IDs
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    additional_tags: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    result: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
      timestamps: true,
      tableName: 'ParseQueue',
      underscored: true,
  });

  return ParseQueue;
};
