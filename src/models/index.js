import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

import UserModel from './User.js';
import GuildModel from './Guild.js';
import RecommendationModel from './Recommendation.js';

import BirthdayMessageModel from './BirthdayMessage.js';
import ParseQueueModel from './ParseQueue.js';
import ParseQueueSubscriberModel from './ParseQueueSubscriber.js';
import ConfigModel from './Config.js';
import SeriesModel from './Series.js';

import ModLockModel from './ModLock.js';

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

if (process.env.NODE_ENV === 'production' && sequelize.getDialect() === 'sqlite') {
    throw new Error('FATAL: SQLite is not allowed in production! Check your config and environment variables.');
}

const User = UserModel(sequelize);
const Guild = GuildModel(sequelize);
const Recommendation = RecommendationModel(sequelize);
const BirthdayMessage = BirthdayMessageModel(sequelize);
const ParseQueue = ParseQueueModel(sequelize);
const ParseQueueSubscriber = ParseQueueSubscriberModel(sequelize);
const UserFicMetadata = UserFicMetadataModel(sequelize);


const Config = ConfigModel(sequelize);
const Series = SeriesModel(sequelize);
const ModLock = ModLockModel(sequelize);


User.belongsToMany(Guild, { through: 'UserGuilds' });
Guild.belongsToMany(User, { through: 'UserGuilds' });
ParseQueue.hasMany(ParseQueueSubscriber, { foreignKey: 'queue_id', as: 'subscribers' });
ParseQueueSubscriber.belongsTo(ParseQueue, { foreignKey: 'queue_id' });
Recommendation.belongsTo(Series, { foreignKey: 'seriesId', as: 'series' });
Series.hasMany(Recommendation, { foreignKey: 'seriesId', as: 'works' });
// UserFicMetadata relations
UserFicMetadata.belongsTo(User, { foreignKey: 'userID', targetKey: 'discordId', as: 'user', constraints: false });
// Not a true FK, but allows eager loading if needed

UserFicMetadata.belongsTo(Recommendation, { foreignKey: 'ao3ID', targetKey: 'ao3ID', as: 'fic', constraints: false });
User.hasMany(UserFicMetadata, { foreignKey: 'userID', sourceKey: 'discordId', as: 'ficMetadata' });
Recommendation.hasMany(UserFicMetadata, { foreignKey: 'ao3ID', sourceKey: 'ao3ID', as: 'userMetadata' });
BirthdayMessage.belongsTo(User, { foreignKey: 'userId', targetKey: 'discordId', as: 'user', constraints: false });
User.hasMany(BirthdayMessage, { foreignKey: 'userId', sourceKey: 'discordId', as: 'birthdayMessages' });

// ModLock associations
ModLock.associate({ Recommendation, User });
Recommendation.hasMany(ModLock, { foreignKey: 'recommendationId', as: 'modLocks' });

export {
    sequelize,
    Sequelize,
    Config,
    User,
    Guild,
    Recommendation,
    BirthdayMessage,
    ParseQueue,
    ParseQueueSubscriber,
    Series,
    UserFicMetadata,
    ModLock
};