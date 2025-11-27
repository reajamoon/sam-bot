import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Recommendation = sequelize.define('Recommendation', {
        ao3ID: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            comment: 'AO3 work ID parsed from URL'
        },
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
        character_tags: {
            type: DataTypes.JSONB, // Array of character tags
            allowNull: true,
            defaultValue: []
        },
        fandom_tags: {
            type: DataTypes.JSONB, // Array of fandom tags
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
            // Deprecated use notes on UserFicMetadata Model
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
        // Foreign key to Series
        seriesId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'series',
                key: 'id'
            }
        },
        // Part number in series
        part: {
            type: DataTypes.INTEGER,
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
        },
        // True if this rec is a non-primary work in a series
        notPrimaryWork: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'not_primary_work'
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
    // For embed display: only include freeform tags and user-added tags
    Recommendation.prototype.getParsedTags = function() {
        const siteTags = Array.isArray(this.tags) ? this.tags : [];
        const userTags = Array.isArray(this.additionalTags) ? this.additionalTags : [];
        return [...siteTags, ...userTags];
    };

    // For flexible tag searching: specify which tag fields to include
    Recommendation.prototype.getTagsFromFields = function(tagFields = ['tags', 'additionalTags']) {
        const allTags = [];
        for (const field of tagFields) {
            const fieldTags = Array.isArray(this[field]) ? this[field] : [];
            allTags.push(...fieldTags);
        }
        return allTags;
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