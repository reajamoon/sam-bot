const { Events } = require('discord.js');
const logger = require('../utils/logger');
const startPoller = require('./startPoller');
const startBirthdayManager = require('./startBirthdayManager');
const BirthdayNotificationManager = require('../utils/birthdayNotifications');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Hey, it's Sam. I'm online and ready to help out.`);
        logger.info(`Currently keeping an eye on ${client.guilds.cache.size} ${client.guilds.cache.size === 1 ? 'server' : 'servers'}`);

        // Set bot status
        client.user.setActivity('the family business', { type: 'PLAYING' });
        // Start poller and birthday manager
        startPoller(client);
        // Use the already-initialized birthdayManager if available, else create one
        if (client.birthdayManager) {
            startBirthdayManager(client, client.birthdayManager);
        } else {
            // Fallback: create a new one if not attached
            const birthdayManager = new BirthdayNotificationManager(client);
            startBirthdayManager(client, birthdayManager);
        }
    },
};