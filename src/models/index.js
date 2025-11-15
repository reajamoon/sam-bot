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

// Runtime check: never allow SQLite in production
if (process.env.NODE_ENV === 'production' && sequelize.getDialect() === 'sqlite') {
    throw new Error('FATAL: SQLite is not allowed in production! Check your config and environment variables.');
}

// Import models
const User = require('./User')(sequelize);
const Guild = require('./Guild')(sequelize);
const Recommendation = require('./Recommendation')(sequelize);

const BirthdayMessage = require('./BirthdayMessage')(sequelize);

const ParseQueue = require('./ParseQueue')(sequelize);
const ParseQueueSubscriber = require('./ParseQueueSubscriber')(sequelize);
const Config = require('./Config')(sequelize);


// Define associations
User.belongsToMany(Guild, { through: 'UserGuilds' });
Guild.belongsToMany(User, { through: 'UserGuilds' });

// ParseQueue <-> ParseQueueSubscriber association for poller
ParseQueue.hasMany(ParseQueueSubscriber, { foreignKey: 'queue_id', as: 'subscribers' });
ParseQueueSubscriber.belongsTo(ParseQueue, { foreignKey: 'queue_id' });



const db = {
    sequelize,
    Sequelize,
    Config,
    User,
    Guild,
    Recommendation,
    BirthdayMessage,
    ParseQueue,
    ParseQueueSubscriber
};

module.exports = db;