"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("parsequeue", "instant_candidate", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "status"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("parsequeue", "instant_candidate");
  }
};
