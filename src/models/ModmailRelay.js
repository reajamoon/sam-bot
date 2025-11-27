import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ModmailRelay = sequelize.define('ModmailRelay', {
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fic_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thread_id: {
      type: DataTypes.STRING,
      allowNull: false,
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
      { unique: false, fields: ['user_id', 'fic_url'] },
      { unique: false, fields: ['thread_id'] }
    ]
  });
  return ModmailRelay;
};
