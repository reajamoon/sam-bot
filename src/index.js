// --- Fic Queue Notification Poller ---
const { ParseQueue, ParseQueueSubscriber, User, Config } = require('./models');
const { EmbedBuilder } = require('discord.js');
const createRecommendationEmbed = require('./utils/recUtils/createRecommendationEmbed');
const POLL_INTERVAL_MS = 10000; // 10 seconds

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
require('dotenv').config();
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

logger.info('Sam bot main file loaded');
logger.info('Registering clientReady event for poller and birthday manager');
client.once('clientReady', () => {
    setInterval(() => notifyQueueSubscribers(client), POLL_INTERVAL_MS);
    logger.info('Fic queue notification poller started.');
    birthdayManager.start();
    logger.info('Birthday notification manager started.');
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
        // Birthday manager now started in clientReady event above
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

async function notifyQueueSubscribers(client) {
    try {
        // Find all jobs that are done and still have subscribers
        const doneJobs = await ParseQueue.findAll({
            where: { status: 'done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        for (const job of doneJobs) {
            // Get all subscribers for this job
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            if (!subscribers.length) continue;
            // Fetch user records for tagging preference
            const userIds = subscribers.map(s => s.user_id);
            const users = await User.findAll({ where: { discordId: userIds } });
            // Build notification embed using shared utility
            let embed = null;
            if (job.result && job.result.title) {
                try {
                    // createRecommendationEmbed expects a rec object; adapt job.result as needed
                    const rec = {
                        ...job.result,
                        url: job.fic_url,
                        id: job.id
                    };
                    embed = await createRecommendationEmbed(rec);
                } catch (err) {
                    logger.error('Failed to build embed with createRecommendationEmbed:', err);
                }
            }
            // Get notification channel from config
            const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
            const channelId = configEntry ? configEntry.value : null;
            if (!channelId) {
                logger.warn('No fic_queue_channel configured; skipping queue notifications.');
                continue;
            }
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                logger.warn(`Fic queue notification channel ${channelId} not found.`);
                continue;
            }
            // Build mention string for users who want to be tagged
            const mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).join(' ');
            // Send notification and embed as separate messages
            try {
                // First, send the notification message (with mentions and fic URL)
                await channel.send({
                    content: `>>> ${mentionList ? mentionList + ' ' : ''}Your fic parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : ''),
                });
                // Then, send the embed (if available)
                if (embed) {
                    await channel.send({ embeds: [embed] });
                }
            } catch (err) {
                logger.error('Failed to send fic queue notification:', err);
            }
            await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
        }
    } catch (err) {
        logger.error('Error in queue notification poller:', err);
    }
}


startBot();