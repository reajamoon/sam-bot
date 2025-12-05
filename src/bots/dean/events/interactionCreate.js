import { MessageFlags } from 'discord.js';

export default function onInteractionCreate(client) {
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error('[dean] Command error:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'There was an error executing that command.' });
      } else {
        await interaction.reply({ content: 'There was an error executing that command.', flags: MessageFlags.Ephemeral });
      }
    }
  });
}
