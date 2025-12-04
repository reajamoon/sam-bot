import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Cas: simple health check');

async function execute(interaction) {
  await interaction.reply({ content: 'Cas is online and watching.', ephemeral: true });
}

export { data };
export default { data, execute };
