const isValidFanficUrl = require('../../utils/recUtils/isValidFanficUrl');
const processRecommendationJob = require('../../utils/recUtils/processRecommendationJob');

// Adds a new fic rec. Checks for duplicates, fetches metadata, and builds the embed.
async function handleAddRecommendation(interaction) {
  try {
    await interaction.deferReply();

    const normalizeAO3Url = require('../../utils/recUtils/normalizeAO3Url');
    let url = interaction.options.getString('url');
    url = normalizeAO3Url(url);
    const manualTitle = interaction.options.getString('title');
    const manualAuthor = interaction.options.getString('author');
    const manualSummary = interaction.options.getString('summary');
    const manualWordCount = interaction.options.getInteger('wordcount');
    const manualRating = interaction.options.getString('rating');
    const additionalTags = interaction.options.getString('tags') ? interaction.options.getString('tags').split(',').map(t => t.trim()) : [];
    const notes = interaction.options.getString('notes');

    if (!url || !isValidFanficUrl(url)) {
      return await interaction.editReply({
        content: 'Please provide a valid fanfiction URL (AO3, FFNet, Wattpad, etc.)'
      });
    }

    // --- Fic Parsing Queue Logic ---
    const { ParseQueue, ParseQueueSubscriber, Recommendation } = require('../../models');
    // Check if fic is already in the library
    const existingRec = await Recommendation.findOne({ where: { url } });
    if (existingRec) {
      const addedDate = existingRec.createdAt ? `<t:${Math.floor(new Date(existingRec.createdAt).getTime()/1000)}:F>` : '';
      return await interaction.editReply({
        content: `*${existingRec.title}* was already added to the library by **${existingRec.recommendedByUsername}**${addedDate ? `, on ${addedDate}` : ''}! Great minds think alike though.`
      });
    }
    // Not in library: check queue
    let queueEntry = await ParseQueue.findOne({ where: { fic_url: url } });
    if (queueEntry) {
      if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
        const existingSub = await ParseQueueSubscriber.findOne({ where: { queue_id: queueEntry.id, user_id: interaction.user.id } });
        if (!existingSub) {
          await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
        }
        return await interaction.editReply({
          content: 'That fic is already being processed! You’ll get a notification when it’s ready.'
        });
      } else if (queueEntry.status === 'done' && queueEntry.result) {
        // Return cached result (simulate embed)
        await processRecommendationJob({
          url,
          user: { id: interaction.user.id, username: interaction.user.username },
          manualFields: {},
          additionalTags,
          notes,
          notify: async (embed) => {
            await interaction.editReply({
              content: null,
              embeds: [embed]
            });
          }
        });
        return;
      } else if (queueEntry.status === 'error') {
        return await interaction.editReply({
          content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`
        });
      }
    }
    // If no entry, create a new pending job and add user as subscriber
    queueEntry = await ParseQueue.create({
      fic_url: url,
      status: 'pending',
      requested_by: interaction.user.id
    });
    await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
    return await interaction.editReply({
      content: 'Your fic has been added to the parsing queue! I’ll notify you when it’s ready.'
    });
  } catch (error) {
    try {
      await interaction.editReply({
        content: error.message || 'There was an error adding the recommendation. Please try again.'
      });
    } catch (replyError) {
      console.error('Failed to send error message in /rec add:', replyError);
    }
    return;
  }
}
module.exports = handleAddRecommendation;