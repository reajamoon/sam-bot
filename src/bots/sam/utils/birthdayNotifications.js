const { User, Guild, BirthdayMessage } = require('../../../../models');
const { EmbedBuilder } = require('discord.js');
const logger = require('../../../shared/utils/logger');

class BirthdayNotificationManager {
    constructor(client) {
        this.client = client;
        this.checkInterval = null;
    }

    // Start the birthday checking system
    start() {
        // Check every 10 minutes for birthdays
        this.checkInterval = setInterval(() => {
            this.checkBirthdays();
        }, 10 * 60 * 1000);

        // Also check immediately on startup
        setTimeout(() => this.checkBirthdays(), 5000);
        
        logger.info('Birthday notification system started');
    }

    // Stop the birthday checking system
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        logger.info('Birthday notification system stopped');
    }

    // Check for birthdays and send notifications
    async checkBirthdays() {
        try {
            const now = new Date();
            const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

            // Get all guilds with birthday configuration
            const guilds = await Guild.findAll({
                where: {
                    birthdayChannelId: { [require('sequelize').Op.not]: null }
                }
            });

            for (const guildConfig of guilds) {
                // Check if it's time to send announcements for this guild
                const announcementTime = guildConfig.birthdayAnnouncementTime;
                const timeDiff = this.getTimeDifference(currentTime, announcementTime);
                
                // If we're within 10 minutes of announcement time, send daily announcement
                if (Math.abs(timeDiff) <= 10) {
                    await this.sendDailyBirthdayAnnouncement(guildConfig, today);
                }

                // Check for individual birthday mentions (send throughout the day)
                await this.sendIndividualBirthdayMentions(guildConfig, today);
            }
        } catch (error) {
            logger.error('Error checking birthdays:', error);
        }
    }

    // Send daily birthday announcement to role holders
    async sendDailyBirthdayAnnouncement(guildConfig, today) {
        try {
            // Check if we already sent today's announcement
            const lastAnnouncementKey = `birthday_announcement_${guildConfig.guildId}_${today}`;
            if (this.hasSentToday(lastAnnouncementKey)) {
                return;
            }

            const guild = this.client.guilds.cache.get(guildConfig.guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(guildConfig.birthdayChannelId);
            if (!channel) return;

            // Get today's birthdays (users who opted into announcements)
            const todaysBirthdays = await this.getTodaysBirthdays(today, true);
            logger.info(`[BirthdayDebug] Found users for today's birthdays:`, todaysBirthdays.map(u => ({ discordId: u.discordId, username: u.username, birthday: u.birthday, birthdayAnnouncements: u.birthdayAnnouncements })));

            if (todaysBirthdays.length === 0) {
                this.markAsSentToday(lastAnnouncementKey);
                logger.info(`[BirthdayDebug] No birthdays to announce for ${guildConfig.guildId} on ${today}`);
                return;
            }

            // Get members with birthday wishes role
            let mentionText = '';
            if (guildConfig.birthdayWishesRoleId) {
                const role = guild.roles.cache.get(guildConfig.birthdayWishesRoleId);
                if (role) {
                    mentionText = `${role} `;
                }
            }

            // Create birthday list
            const birthdayList = todaysBirthdays.map(user => {
                const member = guild.members.cache.get(user.discordId);
                return member ? member.displayName : user.username;
            }).join(', ');
            logger.info(`[BirthdayDebug] Final birthday list for embed: ${birthdayList}`);

            // Create embed for birthday announcement
            const embed = new EmbedBuilder()
                .setColor('#8B4513')
                .setTitle('Hey everyone, we\'ve got birthdays today!')
                .setDescription(birthdayList ? `Looking at today's date, we should be celebrating:\n\n**${birthdayList}**\n\nIn our line of work, celebrating the good moments is important. Take a minute to wish them well - everyone deserves to feel special on their birthday.` : 'No birthdays to celebrate today!')
                .setFooter({
                    text: 'Want me to give you a heads up about birthdays? Just use /birthday-notifications subscribe',
                    iconURL: guild.iconURL() || undefined
                })
                .setTimestamp();

            const messageContent = mentionText ? { content: mentionText, embeds: [embed] } : { embeds: [embed] };
            if (embed.data.description && embed.data.description.length > 0) {
                await channel.send(messageContent);
            } else {
                logger.warn('[BirthdayDebug] Attempted to send empty embed, skipping message.');
            }
            this.markAsSentToday(lastAnnouncementKey);
            
            logger.info(`Sent daily birthday announcement for ${guildConfig.guildId}: ${birthdayList}`);
        } catch (error) {
            logger.error(`Error sending daily birthday announcement for guild ${guildConfig.guildId}:`, error);
        }
    }

    // Send individual birthday mentions
    async sendIndividualBirthdayMentions(guildConfig, today) {
        try {
            const guild = this.client.guilds.cache.get(guildConfig.guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(guildConfig.birthdayChannelId);
            if (!channel) return;

            // Get users who have birthdays today and opted into mentions
            const users = await User.findAll({
                where: {
                    birthdayMentions: true
                }
            });

            for (const user of users) {
                // Check if today is their birthday
                if (this.isBirthdayToday(user.birthday, today)) {
                    // Check database for sent birthday message
                    const alreadySent = await BirthdayMessage.findOne({
                        where: {
                            userId: user.discordId,
                            birthdayDate: today
                        }
                    });
                    if (alreadySent) {
                        continue;
                    }

                    try {
                        const member = await guild.members.fetch(user.discordId);
                        if (!member) continue;

                        // Calculate age if birth year is available and user allows age in announcements
                        let birthdayMessage;
                        if (user.birthday && user.birthday.length > 5 && !user.birthdayAgePrivacy) {
                            const birthYear = parseInt(user.birthday.split('-')[0]);
                            const currentYear = new Date().getFullYear();
                            const age = currentYear - birthYear;
                            const ageWithSuffix = this.getAgeWithOrdinalSuffix(age);
                            birthdayMessage = `Hey ${member}, happy ${ageWithSuffix} birthday! 🎂`;
                        } else {
                            birthdayMessage = `Hey ${member}, happy birthday! 🎂`;
                        }

                        const message = `${birthdayMessage}\n\nHope you get to do something you really enjoy today. Birthdays should be celebrated - we don't get enough good days in this world, so make sure you take time to appreciate this one.`;

                        await channel.send(message);
                        await BirthdayMessage.create({
                            userId: user.discordId,
                            birthdayDate: today,
                            sentAt: new Date()
                        });
                        logger.info(`Sent birthday mention for ${user.username} (${user.discordId})`);
                    } catch (memberError) {
                        // User might not be in this guild, skip
                        continue;
                    }
                }
            }
        } catch (error) {
            logger.error(`Error sending individual birthday mentions for guild ${guildConfig.guildId}:`, error);
        }
    }

    // Get users who have birthdays today
    async getTodaysBirthdays(today, announcementsOnly = false) {
        const whereClause = announcementsOnly ? 
            { birthdayAnnouncements: true } : 
            {};

        const users = await User.findAll({ where: whereClause });
        
        return users.filter(user => this.isBirthdayToday(user.birthday, today));
    }

    // Check if a specific birthday is today
    isBirthdayToday(birthday, today) {
        if (!birthday) return false;

        // Handle both formats: YYYY-MM-DD and MM-DD
        let birthdayMonthDay;
        if (birthday.length === 5) {
            // MM-DD format (privacy mode)
            birthdayMonthDay = birthday;
        } else {
            // YYYY-MM-DD format
            birthdayMonthDay = birthday.substring(5); // Get MM-DD part
        }

        const todayMonthDay = today.substring(5); // Get MM-DD part from YYYY-MM-DD
        return birthdayMonthDay === todayMonthDay;
    }

    // Helper to calculate time difference in minutes
    getTimeDifference(time1, time2) {
        const [h1, m1] = time1.split(':').map(Number);
        const [h2, m2] = time2.split(':').map(Number);
        
        const minutes1 = h1 * 60 + m1;
        const minutes2 = h2 * 60 + m2;
        
        return minutes1 - minutes2;
    }

    // Simple in-memory cache for daily notifications (resets on bot restart)
    sentToday = new Set();

    hasSentToday(key) {
        return this.sentToday.has(key);
    }

    markAsSentToday(key) {
        this.sentToday.add(key);
        
        // Clean up old entries at midnight
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        setTimeout(() => {
            this.sentToday.clear();
        }, tomorrow.getTime() - Date.now());
    }

    // Helper function to add ordinal suffix to age
    getAgeWithOrdinalSuffix(age) {
        // Handle special cases for teens (11th, 12th, 13th)
        if (age >= 11 && age <= 13) {
            return `${age}th`;
        }
        
        // Handle regular cases based on last digit
        const lastDigit = age % 10;
        switch (lastDigit) {
            case 1: return `${age}st`;
            case 2: return `${age}nd`;
            case 3: return `${age}rd`;
            default: return `${age}th`;
        }
    }
}

module.exports = BirthdayNotificationManager;