const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite',
    storage: process.env.NODE_ENV === 'production' ? undefined : './database/bot.sqlite',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Import models
const User = require('./User')(sequelize);
const Guild = require('./Guild')(sequelize);
const Recommendation = require('./Recommendation')(sequelize);

const BirthdayMessage = require('./BirthdayMessage')(sequelize);

const ParseQueue = require('./ParseQueue')(sequelize);
const ParseQueueSubscriber = require('./ParseQueueSubscriber')(sequelize);

// Define associations
User.belongsToMany(Guild, { through: 'UserGuilds' });
Guild.belongsToMany(User, { through: 'UserGuilds' });



const db = {
    sequelize,
    Sequelize,
    User,
    Guild,
    Recommendation,
    BirthdayMessage,
    ParseQueue,
    ParseQueueSubscriber
};

module.exports = db;