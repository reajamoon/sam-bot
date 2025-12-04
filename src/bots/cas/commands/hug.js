import { SlashCommandBuilder } from 'discord.js';
import { emoji, EMOJIS } from '../../../shared/emojiStore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('hug')
    .setDescription('Cas gives a warm hug')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to hug (optional)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const actor = interaction.user;

    // If target is the invoker, Cas hugs them; otherwise hugs the mentioned user.
    const hug = emoji(EMOJIS.cas_hug, '🤗');
    const content = target.id === actor.id
      ? `${hug} ${actor}, I’m giving you a big hug!`
      : `${hug} ${target}, here’s a big hug from me, courtesy of ${actor}!`;

    await interaction.reply({ content });
  }
};
