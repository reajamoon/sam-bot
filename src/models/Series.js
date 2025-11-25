// Series.js - Sequelize model for fanfiction series
import { DataTypes } from 'sequelize';

export default function SeriesModel(sequelize) {
  const Series = sequelize.define('Series', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    fandom: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    author: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    tableName: 'series',
    timestamps: true,
  });
  // Add more fields as needed
  return Series;
}
