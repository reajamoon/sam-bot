// recNotifyTag.js
// /rec notifytag on|off - toggle queue notification tagging for the user
const { User } = require('../../models');

module.exports = async function handleRecNotifyTag(interaction) {
  const mode = interaction.options.getString('mode');
  if (!['on', 'off'].includes(mode)) {
    await interaction.reply({
      content: 'Please specify `on` or `off` to control whether you are tagged in fic queue notifications.',
  flags: require('discord.js').MessageFlags.Ephemeral
    });
    return;
  }
  const userId = interaction.user.id;
  let user = await User.findOne({ where: { discordId: userId } });
  if (!user) {
    user = await User.create({ discordId: userId, username: interaction.user.username });
  }
  user.queueNotifyTag = (mode === 'on');
  await user.save();
  await interaction.reply({
    content: mode === 'on'
      ? 'You will now be tagged in fic queue notifications.'
      : 'You will no longer be tagged in fic queue notifications.',
  flags: require('discord.js').MessageFlags.Ephemeral
  });
};
