import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ProjectMember = sequelize.define('ProjectMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.literal('uuid_generate_v4()'),
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'member',
    },
  }, {
    tableName: 'ProjectMembers',
    timestamps: true,
  });

  ProjectMember.associate = (models) => {
    ProjectMember.belongsTo(models.Project, { foreignKey: 'projectId', as: 'project' });
    ProjectMember.belongsTo(models.User, { foreignKey: 'userId', targetKey: 'discordId', as: 'user', constraints: false });
  };

  return ProjectMember;
};
