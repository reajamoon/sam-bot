import { DataTypes } from 'sequelize';

export default (sequelize) => {
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
  }, {
    timestamps: true,
    tableName: 'ParseQueueSubscribers',
    underscored: true,
  });

  return ParseQueueSubscriber;
};
