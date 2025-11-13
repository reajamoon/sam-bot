const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Recommendation = sequelize.define('Recommendation', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true
        },
        title: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // Deprecated: use authors array instead
        author: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Authors array (native JSONB)
        authors: {
            type: DataTypes.JSONB, // Array of author names
            allowNull: true,
            defaultValue: null
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        tags: {
            type: DataTypes.JSONB, // Array of tags
            allowNull: true,
            defaultValue: []
        },
        rating: {
            type: DataTypes.STRING,
            allowNull: true
        },
        wordCount: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        chapters: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            allowNull: true
        },
        language: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'English'
        },
        publishedDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        updatedDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        recommendedBy: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        recommendedByUsername: {
            type: DataTypes.STRING,
            allowNull: false
        },
        additionalTags: {
            type: DataTypes.JSONB, // User-added custom tags
            allowNull: true,
            defaultValue: []
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        archive_warnings: {
            type: DataTypes.JSONB, // Store as array
            allowNull: true,
            defaultValue: [],
            field: 'archive_warnings'
        },
        kudos: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        hits: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bookmarks: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        comments: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true
        },
        deleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        attachmentUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'attachment_url'
        }
    }, {
        tableName: 'recommendations',
        timestamps: true,
        indexes: [
            {
                fields: ['recommendedBy']
            },
            {
                fields: ['url']
            }
        ]
    });

    // Instance methods
    Recommendation.prototype.getParsedTags = function() {
        const siteTags = Array.isArray(this.tags) ? this.tags : [];
        const userTags = Array.isArray(this.additionalTags) ? this.additionalTags : [];
        return [...siteTags, ...userTags];
    };

    Recommendation.prototype.getArchiveWarnings = function() {
        if (Array.isArray(this.archiveWarnings)) return this.archiveWarnings;
        if (Array.isArray(this.archive_warnings)) return this.archive_warnings;
        return [];
    };

    Recommendation.prototype.addUserTag = function(tag) {
        let userTags = Array.isArray(this.additionalTags) ? this.additionalTags : [];
        if (!userTags.includes(tag)) {
            userTags.push(tag);
            this.additionalTags = userTags;
        }
    };

    return Recommendation;
};