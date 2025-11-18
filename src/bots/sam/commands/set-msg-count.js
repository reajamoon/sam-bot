// Alright, grabbing Discord stuff and our User model
const { SlashCommandBuilder, PermissionFlagsBits, InteractionFlags } = require('discord.js');
const EPHEMERAL_FLAG = InteractionFlags?.Ephemeral ?? 64;
const { User } = require('../../../models');

module.exports = {
    // Command for manually setting someone’s message count (for history imports, etc)
    data: new SlashCommandBuilder()
        .setName('set-msg-count')
        .setDescription('Set someone\'s message count (for adding their epic chat history!)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The chatty person to update')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Their total message count (check Discord search!)')
                .setRequired(true)
                .setMinValue(0))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        // Don’t let non-mods touch this
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.reply({
                    content: 'Whoa there! You need moderator powers to mess with message counts. Nice try though! 😏',
                    flags: EPHEMERAL_FLAG
                });
        }

        // Who are we updating, and what’s their new count?
        const targetUser = interaction.options.getUser('user');
        const messageCount = interaction.options.getInteger('count');

        try {
            // If the user’s not in the DB, add them. Otherwise, just update their stuff.
            const [user, created] = await User.findOrCreate({
                where: { discordId: targetUser.id },
                defaults: {
                    discordId: targetUser.id,
                    username: targetUser.username,
                    discriminator: targetUser.discriminator || '0',
                    avatar: targetUser.avatar,
                    messageCount: messageCount,
                    messageCountSetBy: interaction.user.id,
                    messageCountSetAt: new Date(),
                    lastSeen: new Date()
                        ,messagesSinceAdminSet: 0
                }
            });

            if (!created) {
                // Already exists—just bump their count and update their info
                    await user.update({
                        messageCount: messageCount,
                        messageCountSetBy: interaction.user.id,
                        messageCountSetAt: new Date(),
                        messagesSinceAdminSet: 0,
                        username: targetUser.username,
                        discriminator: targetUser.discriminator || '0',
                        avatar: targetUser.avatar
                    });
            }

                await interaction.reply({
                    content: `Perfect! I've updated **${targetUser.username}**'s message count to **${messageCount.toLocaleString()}** messages. 📊\n\n` +
                            `*Manual count set by **${interaction.user.username}** on <t:${Math.floor(Date.now() / 1000)}:F>*\n\n` +
                            `This gives them credit for their full message history across all time!`,
                    flags: EPHEMERAL_FLAG
                });

            // Just so I have a record in the logs
            console.log(`[ADMIN MESSAGE COUNT] ${interaction.user.username} set ${targetUser.username}'s message count to ${messageCount}`);

        } catch (error) {
            // Something went sideways—log it and let the user know
            console.error('Error setting admin message count:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'Uh oh! Something went wrong while updating the message count. Try again? If it keeps failing, blame the ghosts in the machine!',
                            flags: EPHEMERAL_FLAG
                        });
                } else {
                    await interaction.editReply({
                        content: 'Uh oh! Something went wrong while updating the message count. Try again? If it keeps failing, blame the ghosts in the machine!',
                    });
                }
            } catch (responseError) {
                console.error('Error responding to failed interaction:', responseError);
            }
        }
    },
};