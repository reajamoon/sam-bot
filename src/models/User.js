const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        discordId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        discriminator: {
            type: DataTypes.STRING,
            allowNull: true
        },
        avatar: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isBot: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        joinedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        lastSeen: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        messageCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        experience: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        level: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        birthday: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        timezone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        pronouns: {
            type: DataTypes.STRING,
            allowNull: true
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        region: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'User-specified region/country (validated against country-region-data)'
        },
        regionDisplay: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
            comment: 'Whether to display region in profile (true = visible in timezone field or as separate field when timezone hidden)'
        },
        timezoneDisplay: {
            type: DataTypes.STRING,
            defaultValue: 'iana',
            allowNull: false
        },
        birthdayMentions: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        birthdayAnnouncements: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        birthdayAgePrivacy: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        birthdayAgeOnly: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        birthdayYearHidden: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        birthdayHidden: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        profileBlocked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        messageCountSetBy: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Discord ID of admin who set this message count'
        },
        messageCountSetAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the message count was admin-set'
        },
        messageCountStartDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When message counting started for this user (first time messageCount was incremented)'
        },
        messagesSinceAdminSet: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Number of messages sent since admin last set the message count'
        },
        queueNotifyTag: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
            comment: 'Whether to tag the user in fic queue notifications (true = tag, false = no tag)'
        }
    }, {
        tableName: 'users',
        timestamps: true,
        indexes: [
            {
                fields: ['discordId']
            },
            {
                fields: ['username']
            }
        ]
    });

    // Instance methods
    User.prototype.addExperience = function(amount) {
        this.experience += amount;
        const newLevel = Math.floor(Math.sqrt(this.experience / 100));
        if (newLevel > this.level) {
            this.level = newLevel;
            return true; // Level up occurred
        }
        return false;
    };

    return User;
};