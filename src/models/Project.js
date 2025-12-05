import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Project = sequelize.define('Project', {
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.literal('uuid_generate_v4()'),
      primaryKey: true,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'Projects',
    timestamps: true,
  });

  Project.associate = (models) => {
    Project.belongsTo(models.User, { foreignKey: 'ownerId', as: 'owner', constraints: false });
    Project.hasMany(models.ProjectMember, { foreignKey: 'projectId', as: 'members' });
    Project.hasMany(models.Wordcount, { foreignKey: 'projectId', as: 'wordcounts' });
    Project.hasMany(models.DeanSprints, { foreignKey: 'projectId', as: 'sprints' });
  };

  return Project;
};
