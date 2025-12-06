/** @type {import('sequelize').QueryInterface} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('hunts', {
    key: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false },
    description: { type: Sequelize.TEXT, allowNull: false },
    category: { type: Sequelize.STRING, allowNull: false },
    points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    hidden: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await queryInterface.createTable('hunt_progress', {
    id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
    user_id: { type: Sequelize.STRING, allowNull: false },
    hunt_key: { type: Sequelize.STRING, allowNull: false },
    progress: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    unlocked_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });

  await queryInterface.addIndex('hunt_progress', ['user_id', 'hunt_key'], { unique: true, name: 'hunt_progress_user_key_unique' });
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('hunt_progress', 'hunt_progress_user_key_unique');
  await queryInterface.dropTable('hunt_progress');
  await queryInterface.dropTable('hunts');
}
