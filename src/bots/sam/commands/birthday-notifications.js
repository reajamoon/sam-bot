const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { Guild } = require('../../../models');

module.exports = {
    // Command for subscribing/unsubscribing to birthday notifications
    data: new SlashCommandBuilder()
        .setName('birthday-notifications')
        .setDescription('Subscribe or unsubscribe from daily birthday notifications')
        .addSubcommand(subcommand =>
            subcommand
                .setName('subscribe')
                .setDescription('Subscribe to get pinged when daily birthday lists are posted'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unsubscribe')
                .setDescription('Unsubscribe from daily birthday notifications'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your current subscription status')),
    
    async execute(interaction) {
        // Figure out which subcommand the user picked
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Grab the guild config so I know what role to use
            const guildConfig = await Guild.findOne({ 
                where: { guildId: interaction.guild.id } 
            });

            if (!guildConfig || !guildConfig.birthdayWishesRoleId) {
                // No config yet—let the user know they need an admin
                const embed = new EmbedBuilder()
                    .setColor('#8B4513')
                    .setTitle('Birthday notifications aren\'t set up yet')
                    .setDescription('Looks like the birthday system hasn\'t been configured in this server yet. You\'ll need to ask an admin to run `/birthday-config` first to get things set up.');
                
                return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // Make sure the role still exists
            const birthdayRole = interaction.guild.roles.cache.get(guildConfig.birthdayWishesRoleId);
            if (!birthdayRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B4513')
                    .setTitle('There\'s an issue with the birthday role')
                    .setDescription('The birthday role seems to have disappeared. You\'ll need to ask an admin to reconfigure the birthday system.');
                
                return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // Who’s running the command, and do they already have the role?
            const member = interaction.member;
            const hasRole = member.roles.cache.has(birthdayRole.id);

            // Build the embed for the response
            const embed = new EmbedBuilder()
                .setColor('#8B4513')
                .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            switch (subcommand) {
                case 'subscribe':
                    if (hasRole) {
                        // Already signed up—let them know
                        embed.setColor('#DEB887')
                            .setTitle('You\'re already signed up')
                            .setDescription(`You already have the ${birthdayRole} role, so you're all set. I'll ping you when there are birthdays to celebrate.`);
                    } else {
                        // Add the role and confirm
                        await member.roles.add(birthdayRole);
                        embed.setColor('#228B22')
                            .setTitle('Got it - you\'re signed up for birthday notifications')
                            .setDescription(`I've given you the ${birthdayRole} role. Now I'll let you know when it's time to celebrate someone's birthday. Trust me, in our line of work, we need to celebrate the good moments when we can.`)
                            .setFooter({ text: 'Use /birthday-notifications unsubscribe if you change your mind' });
                    }
                    break;

                case 'unsubscribe':
                    if (!hasRole) {
                        // Not signed up—let them know
                        embed.setColor('#DEB887')
                            .setTitle('You weren\'t subscribed')
                            .setDescription(`You don't have the ${birthdayRole} role, so you weren't getting birthday notifications anyway.`);
                    } else {
                        // Remove the role and confirm
                        await member.roles.remove(birthdayRole);
                        embed.setColor('#A0522D')
                            .setTitle('Alright, I\'ve removed your birthday notifications')
                            .setDescription(`I've taken away the ${birthdayRole} role. You won't get pinged for birthday announcements anymore.`)
                            .setFooter({ text: 'You can always use /birthday-notifications subscribe to get back on the list' });
                    }
                    break;

                case 'status':
                    // Just tell them if they’re signed up or not
                    embed.setTitle('Here\'s your birthday notification status')
                        .setDescription(`**Birthday notifications**: ${hasRole ? 'You\'re signed up ✓' : 'Not signed up'}\n\n${
                            hasRole 
                                ? `You have the ${birthdayRole} role, so I'll ping you when there are birthdays to celebrate.`
                                : `You don't have the ${birthdayRole} role, so you won't get pinged for birthday announcements.`
                        }`)
                        .setFooter({ 
                            text: hasRole 
                                ? 'Use /birthday-notifications unsubscribe to opt out'
                                : 'Use /birthday-notifications subscribe to get birthday notifications'
                        });
                    break;
            }

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            // Something went sideways—log it and let the user know
            console.error('Error in birthday-notifications command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Error')
                .setDescription('There was an error managing your birthday notification subscription. Please try again later.');
            
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
    },
};
