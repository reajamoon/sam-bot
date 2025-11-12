const updateMessages = require('./updateMessages');
const isValidFanficUrl = require('../../utils/recUtils/isValidFanficUrl');
const processRecommendationJob = require('../../utils/recUtils/processRecommendationJob');

// Adds a new fic rec. Checks for duplicates, fetches metadata, and builds the embed.
async function handleAddRecommendation(interaction) {
  try {
    console.log('[rec add] Handler called', {
      user: interaction.user?.id,
      url: interaction.options.getString('url'),
      options: interaction.options.data
    });
    await interaction.deferReply();

    const normalizeAO3Url = require('../../utils/recUtils/normalizeAO3Url');
    let url = interaction.options.getString('url');
    url = normalizeAO3Url(url);
    const manualTitle = interaction.options.getString('title');
    const manualAuthor = interaction.options.getString('author');
    const manualSummary = interaction.options.getString('summary');
    const manualWordCount = interaction.options.getInteger('wordcount');
    const manualRating = interaction.options.getString('rating');
    // Robust tag parsing and deduplication
    let additionalTags = interaction.options.getString('tags')
      ? interaction.options.getString('tags').split(',').map(t => t.trim()).filter(Boolean)
      : [];
    // Deduplicate, case-insensitive
    additionalTags = Array.from(new Set(additionalTags.map(t => t.toLowerCase())));
    const notes = interaction.options.getString('notes');

    if (!url || !isValidFanficUrl(url)) {
      return await interaction.editReply({
        content: 'Please provide a valid fanfiction URL (AO3, FFNet, Wattpad, etc.)'
      }); // Not in updateMessages, but could be added if reused
    }

    // --- Fic Parsing Queue Logic ---
    const { Recommendation } = require('../../models');
    const createOrJoinQueueEntry = require('../../utils/recUtils/createOrJoinQueueEntry');
    // Check if fic is already in the library
    const existingRec = await Recommendation.findOne({ where: { url } });
    if (existingRec) {
      const addedDate = existingRec.createdAt ? `<t:${Math.floor(new Date(existingRec.createdAt).getTime()/1000)}:F>` : '';
      return await interaction.editReply({
        content: `*${existingRec.title}* was already added to the library by **${existingRec.recommendedByUsername}**${addedDate ? `, on ${addedDate}` : ''}! Great minds think alike though.`
      });
    }
    // Use modular queue utility
    const { queueEntry, status, message } = await createOrJoinQueueEntry(url, interaction.user.id);
    if (status === 'processing') {
      return await interaction.editReply({
        content: message || updateMessages.alreadyProcessing
      });
    } else if (status === 'done' && queueEntry.result) {
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
    } else if (status === 'error') {
      return await interaction.editReply({
        content: message || updateMessages.errorPreviously
      });
    } else if (status === 'created') {
      // Optionally, update notes/additional_tags if provided (for new entry only)
      if (notes || (additionalTags && additionalTags.length > 0)) {
        await queueEntry.update({
          notes: notes || '',
          additional_tags: JSON.stringify(additionalTags)
        });
      }
      return await interaction.editReply({
        content: updateMessages.addedToQueue
      });
    } else {
      // Fallback for any other status
      return await interaction.editReply({
        content: message || updateMessages.alreadyInQueue
      });
    }
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