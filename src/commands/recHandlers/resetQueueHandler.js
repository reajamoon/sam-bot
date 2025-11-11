// resetQueueHandler.js
// Handler for /rec resetqueue command: resets all jobs stuck in 'processing' back to 'pending'
const { ParseQueue } = require('../../models');

module.exports = async function handleResetQueue(interaction) {
  await interaction.deferReply({ ephemeral: true });
  // Allow admins or mods (ManageGuild or ManageMessages)
  if (!interaction.member.permissions.has('ManageGuild') && !interaction.member.permissions.has('ManageMessages')) {
    await interaction.editReply({ content: 'You need the Manage Server or Manage Messages permission to use this command.' });
    return;
  }
  const [count] = await ParseQueue.update(
    { status: 'pending' },
    { where: { status: 'processing' } }
  );
  if (count > 0) {
    await interaction.editReply({ content: `Reset ${count} stuck job(s) to pending. The queue worker will retry them now.` });
  } else {
    await interaction.editReply({ content: 'No stuck jobs found. The queue is either empty or already pending.' });
  }
};
