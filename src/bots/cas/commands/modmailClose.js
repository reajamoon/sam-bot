import { SlashCommandBuilder } from 'discord.js';
import { ModmailRelay } from '../../../../models/index.js';

const data = new SlashCommandBuilder()
  .setName('modmail_close')
  .setDescription('Close your modmail session (or mods can close any)')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('User to close modmail for (mods only)')
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser('user');
  const userId = targetUser ? targetUser.id : interaction.user.id;

  const relay = await ModmailRelay.findOne({ where: { user_id: userId, open: true } });
  if (!relay) {
    return await interaction.editReply({ content: "I couldn't find an open modmail session." });
  }

  // Mark closed and attempt to archive the thread
  await relay.update({ open: false });
  try {
    const thread = interaction.client.channels.cache.get(relay.thread_id);
    if (thread && thread.isThread()) {
      await thread.setArchived(true);
    }
  } catch {}

  await interaction.editReply({ content: 'I’ve closed the modmail session.' });
}

export { data };
export default { data, execute };
