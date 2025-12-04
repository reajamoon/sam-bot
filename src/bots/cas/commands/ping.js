import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Simple health check');

async function execute(interaction) {
  await interaction.reply({ content: "I'm online and watching.", ephemeral: true });
}

export { data };
export default { data, execute };
