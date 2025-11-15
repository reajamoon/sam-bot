// --- Fic Queue Notification Poller ---
const { ParseQueue, ParseQueueSubscriber, User, Config } = require('../../models');
const { EmbedBuilder } = require('discord.js');
const POLL_INTERVAL_MS = 10000; // 10 seconds

async function notifyQueueSubscribers() {
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
			// Build notification embed (reuse rec embed if possible)
			let embed = null;
			if (job.result && job.result.title) {
				embed = new EmbedBuilder()
					.setTitle(job.result.title)
					.setDescription(job.result.summary || 'No summary provided.')
					.setURL(job.fic_url)
					.setColor(0x6b4f1d);
				if (job.result.authors && Array.isArray(job.result.authors)) {
					embed.addFields({ name: 'Author(s)', value: job.result.authors.join(', ') });
				}
				if (job.result.tags && Array.isArray(job.result.tags) && job.result.tags.length) {
					embed.addFields({ name: 'Tags', value: job.result.tags.join(', ') });
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
			// Send notification
			try {
				await channel.send({
					content: `${mentionList ? mentionList + ' ' : ''}Your fic parsing job is done!` + (job.fic_url ? `\n<${job.fic_url}>` : ''),
					embeds: embed ? [embed] : []
				});
			} catch (err) {
				logger.error('Failed to send fic queue notification:', err);
			}
			// Remove all subscribers for this job so they are not notified again
			await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
		}
	} catch (err) {
		logger.error('Error in queue notification poller:', err);
	}
}

// Start the poller after the bot is ready
client.once('ready', () => {
	setInterval(notifyQueueSubscribers, POLL_INTERVAL_MS);
	logger.info('Fic queue notification poller started.');
});

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
require('dotenv').config();
const logger = require('../../shared/utils/logger');
const { sequelize } = require('../../models');
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