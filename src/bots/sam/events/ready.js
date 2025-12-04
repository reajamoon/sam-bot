
console.log('READY EVENT MODULE LOADED');
import { ActivityType } from 'discord.js';
import startPoller from './startPoller.js';
import startBirthdayManager from './startBirthdayManager.js';
import BirthdayNotificationManager from '../utils/birthdayNotifications.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Hey, it's Sam. I'm online and ready to help out.`);
        // Set bot status
        client.user.setPresence({
                activities: [{ name: '📚 Managing the library', type: 5 }],
                status: 'online'
            });
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