// Unified Sam bot startup (temp version for review)
const { ParseQueue, ParseQueueSubscriber, User, Config, sequelize } = require('../../models');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
require('dotenv').config();
const logger = require('../../shared/utils/logger');
const createRecommendationEmbed = require('../../shared/recUtils/createRecommendationEmbed');
const BirthdayNotificationManager = require('../../shared/utils/birthdayNotifications');

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

// Poller: Notify queue subscribers for completed jobs
async function notifyQueueSubscribers() {
    try {
        const doneJobs = await ParseQueue.findAll({
            where: { status: 'done' },
            include: [{ model: ParseQueueSubscriber, as: 'subscribers' }]
        });
        for (const job of doneJobs) {
            const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
            if (!subscribers.length) continue;
            // --- Instant candidate suppression logic ---
            let thresholdMs = 3000; // default 3 seconds
            const thresholdConfig = await Config.findOne({ where: { key: 'instant_queue_suppress_threshold_ms' } });
            if (thresholdConfig && !isNaN(Number(thresholdConfig.value))) {
                thresholdMs = Number(thresholdConfig.value);
            }
            const submittedAt = job.submitted_at ? new Date(job.submitted_at) : null;
            const elapsed = submittedAt ? (Date.now() - submittedAt.getTime()) : null;
            if (job.instant_candidate && elapsed !== null && elapsed < thresholdMs) {
                // Clean up subscribers silently, do not notify
                await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
                continue;
            }
            // --- End instant candidate suppression logic ---
            const userIds = subscribers.map(s => s.user_id);
            const users = await User.findAll({ where: { discordId: userIds } });
            let embed = null;
            if (job.result && job.result.title) {
                try {
                    const rec = { ...job.result, url: job.fic_url, id: job.id };
                    embed = await createRecommendationEmbed(rec);
                } catch (err) {
                    logger.error('Failed to build embed with createRecommendationEmbed:', err);
                }
            }
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
            const mentionList = users.filter(u => u.queueNotifyTag !== false).map(u => `<@${u.discordId}>`).join(' ');
            try {
                await channel.send({
                    content: `>>> ${mentionList ? mentionList + ' ' : ''}Your fic parsing job is done!\n` + (job.fic_url ? `\n<${job.fic_url}>` : ''),
                });
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
