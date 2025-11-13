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
        // Authors array (JSON string)
        authors: {
            type: DataTypes.TEXT, // JSON array of author names
            allowNull: true,
            defaultValue: null
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        tags: {
            type: DataTypes.TEXT, // Store as JSON string
            allowNull: true,
            defaultValue: '[]'
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
            allowNull: false
        },
        recommendedByUsername: {
            type: DataTypes.STRING,
            allowNull: false
        },
        additionalTags: {
            type: DataTypes.TEXT, // User-added custom tags
            allowNull: true,
            defaultValue: '[]'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Normalized AO3-style fields
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
        try {
            const siteTags = JSON.parse(this.tags || '[]');
            const userTags = JSON.parse(this.additionalTags || '[]');
            return [...siteTags, ...userTags];
        } catch (error) {
            return [];
        }
    };

    Recommendation.prototype.addUserTag = function(tag) {
        try {
            const userTags = JSON.parse(this.additionalTags || '[]');
            if (!userTags.includes(tag)) {
                userTags.push(tag);
                this.additionalTags = JSON.stringify(userTags);
            }
        } catch (error) {
            this.additionalTags = JSON.stringify([tag]);
        }
    };

    return Recommendation;
};