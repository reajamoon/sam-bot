// Series.js - Sequelize model for fanfiction series
import { DataTypes } from 'sequelize';

export default function SeriesModel(sequelize) {
  const Series = sequelize.define('Series', {
    workIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Array of AO3 work IDs for all works in the series (not all may be imported)'
    },
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    ao3SeriesId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
      comment: 'AO3 series ID parsed from URL'
    },
    authors: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Array of author names for the series'
    },
    workCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Number of works in the series (AO3)'
    },
    wordCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Total word count for the series (AO3)'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Completion status for the series (AO3)'
    }
  }, {
    tableName: 'series',
    timestamps: true,
  });
  // Add more fields as needed
  return Series;
}
