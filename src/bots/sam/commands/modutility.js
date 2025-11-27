
import { SlashCommandBuilder } from 'discord.js';
import { Recommendation, ModLock, User, Config } from '../../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('modutility')
    .setDescription('Moderator utility commands for rec modlocking and admin actions.')
    .addSubcommand(sub =>
      sub.setName('setmodlock')
        .setDescription('Set a modlock on a recommendation field')
        .addStringOption(opt =>
          opt.setName('rec_id')
            .setDescription('Recommendation ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Field to lock (e.g. title, tags, ALL)')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clearmodlock')
        .setDescription('Clear a modlock on a recommendation field')
        .addStringOption(opt =>
          opt.setName('rec_id')
            .setDescription('Recommendation ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Field to unlock (e.g. title, tags, ALL)')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setgloballocks')
        .setDescription('Set global modlocked fields (superadmin only)')
        .addStringOption(opt =>
          opt.setName('fields')
            .setDescription('Comma-separated list of globally locked fields')
            .setRequired(true))
    ),
  async execute(interaction) {
    // Permission check: Only allow users with at least mod-level permissions
    const userId = interaction.user.id;
    let user = await User.findOne({ where: { discordId: userId } });
    let isMod = false;
    let isSuperadmin = false;
    // Check DB first
    if (user && user.permissionLevel) {
      if (['mod', 'admin', 'superadmin'].includes(user.permissionLevel)) isMod = true;
      if (user.permissionLevel === 'superadmin') isSuperadmin = true;
    }
    // Fallback: check Discord roles if DB not set
    if ((!isMod || !isSuperadmin) && interaction.member && interaction.member.roles) {
      const roles = interaction.member.roles.cache || [];
      if (!isMod && roles.some(r => r.name.toLowerCase().includes('mod') || r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('superadmin'))) {
        isMod = true;
      }
      if (!isSuperadmin && roles.some(r => r.name.toLowerCase().includes('superadmin'))) {
        isSuperadmin = true;
      }
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'setgloballocks') {
      if (!isSuperadmin) {
        return await interaction.reply({ content: 'Only superadmins can set global modlocked fields.', ephemeral: true });
      }
      const fields = interaction.options.getString('fields');
      await Config.upsert({ key: 'global_modlocked_fields', value: fields });
      return await interaction.reply({ content: `Set global modlocked fields to: ${fields}`, ephemeral: true });
    }
    if (sub === 'setmodlock') {
      const recId = interaction.options.getString('rec_id');
      const field = interaction.options.getString('field');
      const userId = interaction.user.id;
      const rec = await Recommendation.findByPk(recId);
      if (!rec) {
        return await interaction.reply({ content: `Recommendation ID ${recId} not found.`, ephemeral: true });
      }
      // Upsert user with permissionLevel if not present
      let level = 'mod';
      let user = await User.findOne({ where: { discordId: userId } });
      if (!user) {
        // Try to infer from Discord roles if available, else default to 'mod'
        if (interaction.member && interaction.member.roles) {
          const roles = interaction.member.roles.cache || [];
          if (roles.some(r => r.name.toLowerCase().includes('superadmin'))) level = 'superadmin';
          else if (roles.some(r => r.name.toLowerCase().includes('admin'))) level = 'admin';
        }
        user = await User.create({ discordId: userId, permissionLevel: level });
      } else if (!user.permissionLevel) {
        // Update user if permissionLevel is missing
        if (interaction.member && interaction.member.roles) {
          const roles = interaction.member.roles.cache || [];
          if (roles.some(r => r.name.toLowerCase().includes('superadmin'))) level = 'superadmin';
          else if (roles.some(r => r.name.toLowerCase().includes('admin'))) level = 'admin';
        }
        await user.update({ permissionLevel: level });
      } else {
        if (user.permissionLevel === 'superadmin') level = 'superadmin';
        else if (user.permissionLevel === 'admin') level = 'admin';
        else level = 'mod';
      }
      await ModLock.upsert({
        recommendationId: recId,
        field,
        locked: true,
        lockLevel: level,
        lockedBy: userId,
        lockedAt: new Date(),
        unlockedBy: null,
        unlockedAt: null
      });
      return await interaction.reply({ content: `Locked field "${field}" on rec ID ${recId} at level ${level}.`, ephemeral: true });
    } else if (sub === 'clearmodlock') {
      const recId = interaction.options.getString('rec_id');
      const field = interaction.options.getString('field');
      const userId = interaction.user.id;
      const rec = await Recommendation.findByPk(recId);
      if (!rec) {
        return await interaction.reply({ content: `Recommendation ID ${recId} not found.`, ephemeral: true });
      }
      const lock = await ModLock.findOne({ where: { recommendationId: recId, field, locked: true } });
      if (!lock) {
        return await interaction.reply({ content: `No active lock found for field "${field}" on rec ID ${recId}.`, ephemeral: true });
      }
      await lock.update({ locked: false, unlockedBy: userId, unlockedAt: new Date() });
      return await interaction.reply({ content: `Unlocked field "${field}" on rec ID ${recId}.`, ephemeral: true });
    }
  },
};
