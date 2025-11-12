"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ParseQueue", "submitted_at", {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      after: "instant_candidate"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("ParseQueue", "submitted_at");
  }
};
