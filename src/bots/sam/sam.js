// Unified Sam bot startup (temp version for review)
const { ParseQueue, ParseQueueSubscriber, User, Config, sequelize } = require('../../models');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
require('dotenv').config();
const logger = require('../../shared/utils/logger');
const createRecommendationEmbed = require('../../shared/recUtils/createRecommendationEmbed');
const BirthdayNotificationManager = require('./utils/birthdayNotifications');

const POLL_INTERVAL_MS = 10000;

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Initialize birthday notification manager
const birthdayManager = new BirthdayNotificationManager(client);

// Load command files
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
    } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load event files
const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    logger.info(`Loaded event: ${event.name}`);
}


// Database and bot startup
async function startBot() {
    try {
        await sequelize.authenticate();
        logger.info('Database connection has been established successfully.');
        await sequelize.sync();
        logger.info('Database synchronized successfully.');
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT. Graceful shutdown...');
    birthdayManager.stop();
    await sequelize.close();
    client.destroy();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Graceful shutdown...');
    birthdayManager.stop();
    await sequelize.close();
    client.destroy();
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});
client.on('error', (error) => {
    logger.error('Discord client error:', error);
});

startBot();
