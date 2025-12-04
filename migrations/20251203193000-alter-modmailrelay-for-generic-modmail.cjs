module.exports = {
  async up(queryInterface, Sequelize) {
    // Make fic_url nullable
    await queryInterface.changeColumn('ModmailRelay', 'fic_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Add base_message_id
    await queryInterface.addColumn('ModmailRelay', 'base_message_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Add open flag
    await queryInterface.addColumn('ModmailRelay', 'open', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    // Add last_user_message_at
    await queryInterface.addColumn('ModmailRelay', 'last_user_message_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert additions
    await queryInterface.removeColumn('ModmailRelay', 'base_message_id');
    await queryInterface.removeColumn('ModmailRelay', 'open');
    await queryInterface.removeColumn('ModmailRelay', 'last_user_message_at');
    // Make fic_url non-nullable again
    await queryInterface.changeColumn('ModmailRelay', 'fic_url', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  }
};
