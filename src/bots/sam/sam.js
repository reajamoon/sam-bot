console.log('ENTRYPOINT REACHED: sam.js');
import { ParseQueue, ParseQueueSubscriber, User, Config, sequelize } from '../../models/index.js';
import Discord from 'discord.js';
const { Client, Collection, GatewayIntentBits } = Discord;
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import logger from '../../shared/utils/logger.js';
import BirthdayNotificationManager from './utils/birthdayNotifications.js';
import registerSamCommands from './registerCommands.js';
import { initEmojiStore } from '../../shared/emojiStore.js';

dotenv.config();

const POLL_INTERVAL_MS = 10000;

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Initialize birthday notification manager
const birthdayManager = new BirthdayNotificationManager(client);

// Load command files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const commandModule = await import(pathToFileURL(filePath));
    const command = commandModule.default || commandModule;
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
    const eventModule = await import(pathToFileURL(filePath));
    const event = eventModule.default || eventModule;
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
        const REGISTER_ON_BOOT = String(process.env.SAM_REGISTER_ON_BOOT || 'false').toLowerCase() === 'true';
        const token = (process.env.SAM_BOT_TOKEN || '').trim();
        if (!token) {
            logger.error('SAM_BOT_TOKEN is not set.');
            process.exit(1);
        }
        await client.login(token);
        if (REGISTER_ON_BOOT) {
            // Register slash commands after login to avoid duplicate REST churn on restarts
            await registerSamCommands(client);
        } else {
            logger.info('[sam] Skipping command registration on boot (SAM_REGISTER_ON_BOOT=false).');
        }
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

// Initialize emoji store when ready
client.once('ready', async () => {
    const ok = await initEmojiStore(client).catch(() => false);
    if (!ok) {
        logger.warn('[sam] Emoji store did not initialize. Check guild ID env (SAM_GUILD_ID or GUILD_ID).');
    }
});
