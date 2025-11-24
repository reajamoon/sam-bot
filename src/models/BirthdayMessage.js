import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const BirthdayMessage = sequelize.define('BirthdayMessage', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        birthdayDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        sentAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        tableName: 'birthday_messages',
        timestamps: false,
        indexes: [
            { fields: ['userId', 'birthdayDate'] }
        ]
    });
    return BirthdayMessage;
};
