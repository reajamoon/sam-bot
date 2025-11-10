const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
require('dotenv').config();
console.log('[sam-bot] DATABASE_URL:', process.env.DATABASE_URL);
const logger = require('./utils/logger');
const { sequelize } = require('./models');
const BirthdayNotificationManager = require('./utils/birthdayNotifications');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

// Create collections for commands
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

// Initialize database and start bot
async function startBot() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Database connection has been established successfully.');
        
        // Sync database models
        await sequelize.sync();
        logger.info('Database synchronized successfully.');
        
        // Login to Discord
        await client.login(process.env.BOT_TOKEN);
        
        // Start birthday notification system after bot is ready
        client.once('clientReady', () => {
            birthdayManager.start();
        });
        
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle process termination
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Don't exit the process, just log the error
});

// Add client error handler
client.on('error', (error) => {
    logger.error('Discord client error:', error);
});

startBot();