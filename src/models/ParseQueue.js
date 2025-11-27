import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ParseQueue = sequelize.define('ParseQueue', {
    fic_url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'done', 'error', 'nOTP'),
      allowNull: false,
      defaultValue: 'pending',
    },
    instant_candidate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
        submitted_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
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
    validation_reason: {
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
