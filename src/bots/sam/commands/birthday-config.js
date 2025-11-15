// Imports for Discord stuff and the Guild model
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { Guild } = require('../../../models');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday-config')
        .setDescription('Configure birthday notifications for Profound Bond')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the birthday notification channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for birthday notifications')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Set the birthday wishes role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to mention for daily birthday announcements')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('time')
                .setDescription('Set the daily announcement time')
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Time for daily announcements (24-hour format, e.g., 09:00)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View current birthday configuration')),
    async execute(interaction) {
        // Only let mods use this command
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return await interaction.reply({
                content: 'You\'re gonna need moderator permissions to mess with the birthday setup.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Figure out which subcommand was used
        const subcommand = interaction.options.getSubcommand();

        try {
            // Get or create the guild config
            let [guildConfig, created] = await Guild.findOrCreate({
                where: { guildId: interaction.guild.id },
                defaults: {
                    guildId: interaction.guild.id,
                    name: interaction.guild.name,
                    ownerId: interaction.guild.ownerId
                }
            });

            if (subcommand === 'channel') {
                // Set the channel for birthday notifications
                const channel = interaction.options.getChannel('channel');

                if (!channel.isTextBased()) {
                    return await interaction.reply({
                        content: 'Look, I need a text channel. Can\'t exactly announce birthdays in a voice channel.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                await guildConfig.update({ birthdayChannelId: channel.id });

                await interaction.reply({
                    content: `Alright, birthday stuff goes in ${channel} now.\n\nBoth the individual wishes and daily lists will show up there.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            else if (subcommand === 'role') {
                // Set the role to ping for birthdays
                const role = interaction.options.getRole('role');

                await guildConfig.update({ birthdayWishesRoleId: role.id });

                await interaction.reply({
                    content: `Cool. I'll ping ${role} when there are birthdays.\n\nPeople can use \`/birthday-notifications subscribe\` to get that role and hear about birthday stuff.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            else if (subcommand === 'time') {
                // Set the time for daily birthday announcements
                const timeInput = interaction.options.getString('time');

                // Make sure the time is in 24-hour format
                const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
                if (!timeRegex.test(timeInput)) {
                    return await interaction.reply({
                        content: 'That time format\'s not gonna work. I need 24-hour format, like 09:00 or 14:30.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                await guildConfig.update({ birthdayAnnouncementTime: timeInput });

                await interaction.reply({
                    content: `Okay, daily birthday announcements happen around **${timeInput}**.\n\nI'll handle the rest automatically when people have birthdays.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            else if (subcommand === 'status') {
                // Show the current birthday config in an embed
                const embed = new EmbedBuilder()
                    .setTitle('🎂 Profound Bond Birthday System')
                    .setColor('#8B4513')
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .addFields([
                        {
                            name: '📢 Birthday channel',
                            value: guildConfig.birthdayChannelId ? 
                                   `${interaction.guild.channels.cache.get(guildConfig.birthdayChannelId) || `<#${guildConfig.birthdayChannelId}>`}` : 
                                   'Not set',
                            inline: true
                        },
                        {
                            name: '🏷️ Birthday pings',
                            value: guildConfig.birthdayWishesRoleId ? 
                                   `<@&${guildConfig.birthdayWishesRoleId}>` : 
                                   'No role set',
                            inline: true
                        },
                        {
                            name: '⏰ Daily list time',
                            value: guildConfig.birthdayAnnouncementTime || '09:00 (default)',
                            inline: true
                        },
                        {
                            name: '📊 System status',
                            value: guildConfig.birthdayChannelId ? 
                                   'Everything\'s set up and working' : 
                                   'Need a channel before I can start posting birthdays',
                            inline: false
                        },
                        {
                            name: '⚙️ Setup guide',
                            value: '1. Pick a channel: `/birthday-config channel #your-channel`\n' +
                                   '2. Set up a role: `/birthday-config role @role`\n' +
                                   '3. Choose a time: `/birthday-config time 09:00`\n' +
                                   '4. Let people set their birthdays with `/profile`\n\n' +
                                   'Once that\'s done, people can use `/birthday-notifications subscribe` to get pinged about birthdays.',
                            inline: false
                        }
                    ])
                    .setFooter({
                        text: 'Birthday system configuration',
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            // If something blows up, log it and let the user know
            console.error('Error in birthday-config command:', error);
            await interaction.reply({
                content: 'Something went wrong while updating the birthday configuration. Mind trying that again?',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
