import { SlashCommandBuilder } from 'discord.js';
import { Config } from '../../../models/index.js';
import { clearGlobalModlockedFieldsCache } from '../../../shared/modlockUtils.js';
import updateMessages from '../../../shared/text/updateMessages.js';

function isStaff(userRow) {
  const level = userRow?.permissionLevel || 'member';
  return level === 'admin' || level === 'superadmin' || level === 'mod';
}

const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Admin: set runtime configuration flags')
  .addSubcommand(sub =>
    sub.setName('set')
      .setDescription('Set a config key to a value')
      .addStringOption(opt =>
        opt.setName('key')
          .setDescription('Config key (e.g., bots_respect_global_modlocks)')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('value')
          .setDescription('Value (e.g., true/false)')
          .setRequired(true))
  );

async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Permission check via Users table
    const { User } = await import('../../../models/index.js');
    const userRow = await User.findOne({ where: { discordId: interaction.user.id } });
    if (!isStaff(userRow)) {
      return await interaction.editReply({ content: 'You do not have permission to use this command.' });
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'set') {
      return await interaction.editReply({ content: 'Unsupported subcommand.' });
    }

    const key = interaction.options.getString('key').trim();
    const value = interaction.options.getString('value').trim();

    // Upsert into Config table
    const existing = await Config.findOne({ where: { key } });
    if (existing) {
      await existing.update({ value });
    } else {
      await Config.create({ key, value });
    }

    // Clear caches if relevant
    if (key === 'global_modlocked_fields' || key === 'bots_respect_global_modlocks') {
      clearGlobalModlockedFieldsCache();
    }

    return await interaction.editReply({ content: `Config updated: ${key}=${value}` });
  } catch (err) {
    console.error('[config command] Error:', err);
    try {
      await interaction.editReply({ content: updateMessages.genericError || 'There was an error.' });
    } catch {}
  }
}

// Provide both styles: named export and default object for backward compatibility
export { data };
export default { data, execute };
