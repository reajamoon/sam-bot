const { Events } = require('discord.js');
const { User } = require('../models');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Don't track bot messages
        if (message.author.bot) return;
        
        // Only track messages in the Profound Bond server
        if (message.guild?.id !== process.env.PROFOUND_BOND_GUILD_ID) return;
        
        try {
            // Find or create user in database
            const [user, created] = await User.findOrCreate({
                where: { discordId: message.author.id },
                defaults: {
                    discordId: message.author.id,
                    username: message.author.username,
                    discriminator: message.author.discriminator || '0',
                    avatar: message.author.avatar,
                    messageCount: 1,
                    messageCountStartDate: new Date(), // Set when first message is tracked
                    lastSeen: new Date()
                }
            });

            if (!created) {
                // Update existing user
                const updateData = {
                    username: message.author.username,
                    discriminator: message.author.discriminator || '0',
                    avatar: message.author.avatar,
                    lastSeen: new Date()
                };
                // If this user doesn't have a messageCountStartDate yet, set it now (backward compatibility)
                if (!user.messageCountStartDate) {
                    updateData.messageCountStartDate = new Date();
                }
                // If admin has set the message count before
                if (user.messageCountSetAt) {
                    updateData.messageCount = user.messageCount + 1;
                    updateData.messagesSinceAdminSet = (user.messagesSinceAdminSet || 0) + 1;
                } else {
                    updateData.messageCount = user.messageCount + 1;
                }
                await user.update(updateData);
                // Add experience points (optional - for future leveling system)
                // You can enable this later when you implement leveling
                // const leveledUp = user.addExperience(Math.floor(Math.random() * 15) + 10);
                // await user.save();
                // if (leveledUp) {
                //     // Could send a level up message here
                //     console.log(`${message.author.username} leveled up to ${user.level}!`);
                // }
            }
            
        } catch (error) {
            console.error('Error tracking message:', error);
        }
    }
};