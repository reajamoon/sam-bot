import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Guild = sequelize.define('Guild', {
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ownerId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        memberCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true
        },
        prefix: {
            type: DataTypes.STRING,
            defaultValue: process.env.COMMAND_PREFIX || '!'
        },
        welcomeChannelId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        welcomeMessage: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        autoRole: {
            type: DataTypes.STRING,
            allowNull: true
        },
        modLogChannelId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        birthdayChannelId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        birthdayWishesRoleId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        birthdayAnnouncementTime: {
            type: DataTypes.STRING,
            defaultValue: '09:00',
            allowNull: false
        }
    }, {
        tableName: 'guilds',
        timestamps: true,
        indexes: [
            {
                fields: ['guildId']
            },
            {
                fields: ['name']
            }
        ]
    });

    return Guild;
};