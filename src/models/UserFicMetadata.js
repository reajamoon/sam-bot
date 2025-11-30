import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const UserFicMetadata = sequelize.define('UserFicMetadata', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ao3ID: {
            type: DataTypes.INTEGER,
            allowNull: true, // Now nullable for series recs
        },
        seriesId: {
            type: DataTypes.INTEGER,
            allowNull: true, // Only set for series recs
        },
        manual_title: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        manual_authors: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
        },
        manual_summary: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        manual_tags: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
        },
        manual_rating: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        manual_wordcount: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        manual_chapters: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        manual_status: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        manual_archive_warnings: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
        },
        manual_seriesName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        manual_seriesPart: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        manual_seriesUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        additional_tags: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
        },
        rec_note: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        tableName: 'user_fic_metadata',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['userID', 'ao3ID', 'seriesId']
            }
        ]
    });

    return UserFicMetadata;
};
