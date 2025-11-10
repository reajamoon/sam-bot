const { Recommendation } = require('../../models/index.js');
const { fetchFicMetadata } = require('../../utils/recUtils/ficParser.js');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const createRecommendationEmbed = require('../../utils/recUtils/createRecommendationEmbed');

const isValidFanficUrl = require('../../utils/recUtils/isValidFanficUrl');

// Adds a new fic rec. Checks for duplicates, fetches metadata, and builds the embed.
async function handleAddRecommendation(interaction) {
  try {
    await interaction.deferReply();

    // Extract options from interaction (assuming slash command)
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

    // Validate URL
    if (!url || !isValidFanficUrl(url)) {
      return await interaction.editReply({
        content: 'Please provide a valid fanfiction URL (AO3, FFNet, Wattpad, etc.)'
      });
    }

    // See if this fic is already in the database
    const existingRec = await Recommendation.findOne({
      where: {
        url: url
      }
    });

    if (existingRec) {
      return await interaction.editReply({
        content: `That fic's already in our library. ${existingRec.recommendedByUsername} added it on ${existingRec.createdAt.toLocaleDateString()}. Great minds think alike though!`
      });
    }

    let metadata;
    // If the user gave a title and author, just use those instead of parsing
    if (manualTitle && manualAuthor) {
      metadata = {
        title: manualTitle,
        authors: [manualAuthor],
        summary: manualSummary || 'Manually added recommendation',
        tags: [],
        rating: manualRating || 'Not Rated',
        language: 'English',
        wordCount: manualWordCount,
        url: url
      };
    } else {
      // Try to grab fic details automatically from the URL
  metadata = await fetchFicMetadata(url);
  // If the parser returned a url, normalize it too (for consistency)
  if (metadata && metadata.url) metadata.url = normalizeAO3Url(metadata.url);
      if (!metadata) {
        return await interaction.editReply({
          content: 'I couldn\'t fetch the details from that URL. Make sure it\'s a valid, public fanfiction link and try again. Sometimes the archives can be a bit finicky.'
        });
      }
      // If the site blocks me (Cloudflare etc), tell the user to add details manually
      if (metadata.error && metadata.error === 'Site protection detected') {
        return await interaction.editReply({
          content: `Ugh, looks like that site's got some kind of major mojo going on. I can't get past their defenses to grab the story details automatically. \n\nI mean, I get it, they're trying to keep the bad guys out, but it's blocking the good guys too. If you really want to add this one, you'll have to tell me the title and author yourself. Try the command again like this:\n\n\`/rec add url:${url} title:\"Story Title Here\" author:\"Author Name Here\"\`\n\n*This usually happens with FanFiction.Net - they're pretty paranoid over there.*`
        });
      }
      // If the link is dead (404), let the user know and give some tips
      if (metadata.is404 || (metadata.error && metadata.error === '404_not_found')) {
        return await interaction.editReply({
          content: `📭 **Story Not Found (404)**\n\nThat link seems to be broken - the story has either been deleted, moved, or never existed at that URL. This happens sometimes when:\n\n• The author deleted their work\n• The story was moved to a different URL\n• The link was copied incorrectly\n• The site restructured their URLs\n\nYou might want to:\n• Check if the author has an updated link\n• Search for the story on the same site by title/author\n• Look for the story on other platforms\n\nSorry I couldn't add this one to the library! 📚`
        });
      }
      // Handle other HTTP errors (403, connection issues, etc)
      if (metadata.is403) {
        return await interaction.editReply({
          content: `🔒 **Access Restricted (403)**\n\nI can't access this story - it's either:\n• Locked to registered users only\n• Restricted by age verification\n• Set to private/friends-only\n\nYou might need to log in to the site to access it. If you can view it while logged in, you can still add it manually:\n\n\`/rec add url:${url} title:\"Story Title Here\" author:\"Author Name Here\"\``
        });
      }
      if (metadata.isHttpError) {
        return await interaction.editReply({
          content: `⚠ **Connection Error**\n\nI'm having trouble connecting to that site right now. This could be:\n• The site is temporarily down\n• Server maintenance\n• Network connectivity issues\n\nTry again in a few minutes, or add the story manually if you can access it:\n\n\`/rec add url:${url} title:\"Story Title Here\" author:\"Author Name Here\"\``
        });
      }
      // If the user gave manual fields, use those instead of what I parsed
  if (manualTitle) metadata.title = manualTitle;
  if (manualAuthor) metadata.authors = [manualAuthor];
  if (manualSummary) metadata.summary = manualSummary;
  if (manualWordCount) metadata.wordCount = manualWordCount;
  if (manualRating) metadata.rating = manualRating;
    }

    // Actually add the fic to the database
    const recommendation = await Recommendation.create({
      url: url,
      title: metadata.title,
      author: (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author',
      summary: metadata.summary,
      tags: JSON.stringify(metadata.tags || []),
      rating: metadata.rating,
      wordCount: metadata.wordCount,
      chapters: metadata.chapters,
      status: metadata.status,
      language: metadata.language,
      publishedDate: metadata.publishedDate,
      updatedDate: metadata.updatedDate,
      recommendedBy: interaction.user.id,
      recommendedByUsername: interaction.user.username,
      additionalTags: JSON.stringify(additionalTags),
      notes: notes,
      // AO3-style fields for stats and sorting
      kudos: metadata.kudos,
      hits: metadata.hits,
      bookmarks: metadata.bookmarks,
      comments: metadata.comments,
      category: metadata.category
    });

    // Build the embed for the response, same format as random/search
    // Build the rec object for the embed utility
    const recForEmbed = {
      ...metadata,
      authors: metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']),
      url,
      id: recommendation.id,
      recommendedByUsername: interaction.user.username,
      notes,
      // Provide a getParsedTags method for compatibility
      getParsedTags: function() {
        // Prefer additionalTags if provided, else use metadata.tags
        if (Array.isArray(additionalTags) && additionalTags.length > 0) return additionalTags;
        if (Array.isArray(this.tags)) return this.tags;
        if (typeof this.tags === 'string') {
          try {
            const parsed = JSON.parse(this.tags);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
        }
        return [];
      }
    };
    const embed = await createRecommendationEmbed(recForEmbed);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // If something goes wrong, reply with a single error message
    try {
      await interaction.editReply({
        content: error.message || 'There was an error adding the recommendation. Please try again.'
      });
    } catch (replyError) {
      // If editReply fails (e.g. interaction already replied), just log
      console.error('Failed to send error message in /rec add:', replyError);
    }
    return;
  }
}
module.exports = handleAddRecommendation;