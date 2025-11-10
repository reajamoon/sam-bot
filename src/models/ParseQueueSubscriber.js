const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ParseQueueSubscriber = sequelize.define('ParseQueueSubscriber', {
    queue_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ParseQueue',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Channel to notify when fic parsing is complete'
    },
  }, {
    timestamps: true,
    tableName: 'ParseQueueSubscribers',
  });

  return ParseQueueSubscriber;
};
