import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Wordcount = sequelize.define('Wordcount', {
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.literal('uuid_generate_v4()'),
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    sprintId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    countStart: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    countEnd: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    delta: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
  }, {
    tableName: 'Wordcounts',
    timestamps: true,
  });

  Wordcount.associate = (models) => {
    Wordcount.belongsTo(models.User, { foreignKey: 'userId', targetKey: 'discordId', as: 'user', constraints: false });
    Wordcount.belongsTo(models.Project, { foreignKey: 'projectId', as: 'project' });
    Wordcount.belongsTo(models.DeanSprints, { foreignKey: 'sprintId', as: 'sprint' });
  };

  return Wordcount;
};
