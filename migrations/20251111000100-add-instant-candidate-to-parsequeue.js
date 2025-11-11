"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ParseQueue", "instant_candidate", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "status"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("ParseQueue", "instant_candidate");
  }
};
