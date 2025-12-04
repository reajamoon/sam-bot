import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ModmailRelay = sequelize.define('ModmailRelay', {
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fic_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    thread_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    base_message_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    open: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_user_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_relayed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    timestamps: false,
    tableName: 'ModmailRelay',
    indexes: [
      { unique: false, fields: ['user_id'] },
      { unique: false, fields: ['thread_id'] }
    ]
  });
  return ModmailRelay;
};
