const { Events } = require('discord.js');
const { User, Guild } = require('../../../models');
const logger = require('../../../shared/utils/logger');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        logger.info(`Joined new guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);

        try {
            // Create or update guild record
            await Guild.upsert({
                guildId: guild.id,
                name: guild.name,
                ownerId: guild.ownerId,
                memberCount: guild.memberCount,
                icon: guild.icon
            });

            logger.info(`Guild ${guild.name} saved to database`);
        } catch (error) {
            logger.error(`Error saving guild ${guild.name} to database:`, error);
        }
    },
};