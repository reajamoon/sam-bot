import { SlashCommandBuilder } from 'discord.js';
import { listGuildEmojis, formatEmojiList } from '../../../shared/utils/emoji.js';

export default {
  data: new SlashCommandBuilder()
    .setName('emojis')
    .setDescription('List server custom emojis'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId;
    const emojis = await listGuildEmojis(interaction.client, guildId);
    const text = formatEmojiList(emojis);
    // Use code block for readability if long
    const content = text.length > 1800 ? text.slice(0, 1800) + '\n…' : text;
    await interaction.editReply({ content });
  }
};
