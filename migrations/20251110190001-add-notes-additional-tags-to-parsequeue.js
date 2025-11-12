"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ParseQueue", "notes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("ParseQueue", "additional_tags", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("ParseQueue", "notes");
    await queryInterface.removeColumn("ParseQueue", "additional_tags");
  }
};
