import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    // Command for checking if the bot’s alive and how fast it’s moving
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if I\'m still here and how fast I\'m responding'),
    async execute(interaction) {
        // Log some details so I know this fired
        console.log('Ping command executed:', {
            id: interaction.id,
            user: interaction.user.tag,
            guild: interaction.guild?.name,
            timestamp: interaction.createdTimestamp,
            now: Date.now(),
            replied: interaction.replied,
            deferred: interaction.deferred
        });

        // Quick reply
        await interaction.reply({ content: 'Just a sec, checking my connection...' });
        const sent = await interaction.fetchReply();
        const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;

        // Edit the reply with actual ping info
        await interaction.editReply(`Yeah, I'm here!\n📶 Response time: ${timeDiff}ms\n📡 Discord connection: ${Math.round(interaction.client.ws.ping)}ms`);
    },
};