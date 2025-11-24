// queueHandler.js
// Handler for /rec queue command: shows the current fic metadata queue
import { ParseQueue } from '../../../../models.js';
import { EmbedBuilder, MessageFlags } from 'discord.js';

export default async function handleQueue(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  // Get all jobs that are pending or processing, ordered oldest first
  const jobs = await ParseQueue.findAll({
    where: { status: ['pending', 'processing'] },
    order: [['created_at', 'ASC']],
  });

  if (!jobs.length) {
    await interaction.editReply({
      content: 'The fic parsing queue is currently empty! All caught up.'
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Fic Parsing Queue')
    .setDescription('These are the fics currently waiting for metadata parsing. Jobs are processed in order.')
    .setColor(0x6b4f1d);

  for (const job of jobs.slice(0, 10)) {
    embed.addFields({
      name: job.fic_url,
      value: `Status: ${job.status}\nRequested: <t:${Math.floor(new Date(job.submitted_at).getTime()/1000)}:R>`
    });
  }
  if (jobs.length > 10) {
    embed.setFooter({ text: `Showing first 10 of ${jobs.length} jobs.` });
  }

  await interaction.editReply({ embeds: [embed] });
}
