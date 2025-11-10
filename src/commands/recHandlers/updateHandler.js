const { Recommendation } = require('../../models');
const { fetchFicMetadata } = require('../../utils/recUtils/ficParser');
const findRecommendationByIdOrUrl = require('../../utils/recUtils/findRecommendationByIdOrUrl');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const createRecommendationEmbed = require('../../utils/recUtils/createRecommendationEmbed');

const isValidFanficUrl = require('../../utils/recUtils/isValidFanficUrl');

// Modular validation helpers
function validateAttachment(newAttachment, willBeDeleted) {
    const allowedTypes = [
        'text/plain', 'application/pdf', 'application/epub+zip',
        'application/x-mobipocket-ebook', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword', 'application/rtf'
    ];
    if (!willBeDeleted) {
        return 'File attachments are only for stories that have been deleted from their original sites. Mark it as deleted first.';
    }
    if (!allowedTypes.includes(newAttachment.contentType)) {
        return 'Unsupported file type. Only text files, PDFs, EPUBs, and similar formats are allowed.';
    }
    if (newAttachment.size > 10 * 1024 * 1024) {
        return 'File size exceeds 10MB limit.';
    }
    return null;
}

async function handleUpdateRecommendation(interaction) {
    // Timing diagnostics
    try {
        const startTime = Date.now();
        console.log(`[rec update] Interaction received at: ${new Date().toISOString()}`);
        console.log(`[rec update] Discord interaction createdTimestamp: ${interaction.createdTimestamp}`);
        console.log(`[rec update] Discord interaction age (ms): ${Date.now() - interaction.createdTimestamp}`);
        await interaction.deferReply();
        console.log(`[rec update] deferReply completed in ${Date.now() - startTime}ms`);

    const normalizeAO3Url = require('../../utils/recUtils/normalizeAO3Url');
    const recId = interaction.options.getInteger('id');
    const findUrl = interaction.options.getString('find_url');
    const findAo3Id = interaction.options.getInteger('find_ao3_id');
    let newUrl = interaction.options.getString('new_url');
    if (newUrl) newUrl = normalizeAO3Url(newUrl);
        const newTitle = interaction.options.getString('title');
        const newAuthor = interaction.options.getString('author');
        const newSummary = interaction.options.getString('summary');
        const newRating = interaction.options.getString('rating');
        const newStatus = interaction.options.getString('status');
        const newWordCount = interaction.options.getInteger('wordcount');
        const newDeleted = interaction.options.getBoolean('deleted');
        const newAttachment = interaction.options.getAttachment('attachment');
        const newTags = interaction.options.getString('tags')?.split(',').map(tag => tag.trim()).filter(tag => tag) || null;
        const newNotes = interaction.options.getString('notes');

        const findStart = Date.now();
        console.log('[rec update] Finding recommendation...');
        const recommendation = await findRecommendationByIdOrUrl(interaction, recId, findUrl, findAo3Id);
        console.log(`[rec update] Recommendation found: ${!!recommendation} (find took ${Date.now() - findStart}ms)`);
        if (!recommendation) {
            await interaction.editReply({
                content: `I couldn't find a recommendation with ID ${recId} in our library. Use \`/rec stats\` to see what's available.`
            });
            return;
        }

        const isOwner = recommendation.recommendedBy === interaction.user.id;
        const isAdmin = interaction.member.permissions.has('ManageMessages');
        if (!isOwner && !isAdmin) {
            await interaction.editReply({
                content: `That recommendation was added by ${recommendation.recommendedByUsername}. You can only update your own recommendations unless you're a moderator.`
            });
            return;
        }

        let urlToUse = newUrl || recommendation.url;
        urlToUse = normalizeAO3Url(urlToUse);
        let shouldUpdateMetadata = false;
        let metadata = null;

        // --- Fic Parsing Queue Logic ---
        const { ParseQueue, ParseQueueSubscriber } = require('../../models');
        // Only queue if updating metadata (not just tags/notes/etc)
        if (newUrl || (!newUrl && !newTags && !newNotes && !newTitle && !newAuthor && !newSummary && !newRating && !newStatus && !newWordCount)) {
            // Check if a queue entry exists for this fic_url
            let queueEntry = await ParseQueue.findOne({ where: { fic_url: urlToUse } });
            if (queueEntry) {
                if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
                    // Add user as subscriber if not already
                    const existingSub = await ParseQueueSubscriber.findOne({ where: { queue_id: queueEntry.id, user_id: interaction.user.id } });
                    if (!existingSub) {
                        await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
                    }
                    await interaction.editReply({
                        content: 'That fic is already being processed! You’ll get a notification when it’s ready.'
                    });
                    return;
                } else if (queueEntry.status === 'done' && queueEntry.result) {
                    // Return cached result (simulate embed)
                    const embed = await createRecommendationEmbed(queueEntry.result);
                    await interaction.editReply({
                        content: 'This fic was already parsed! Here are the details:',
                        embeds: [embed]
                    });
                    return;
                } else if (queueEntry.status === 'error') {
                    await interaction.editReply({
                        content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`
                    });
                    return;
                }
            }
            // If no entry, create a new pending job and add user as subscriber
            queueEntry = await ParseQueue.create({
                fic_url: urlToUse,
                status: 'pending',
                requested_by: interaction.user.id
            });
            await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
            await interaction.editReply({
                content: 'Your fic has been added to the parsing queue! I’ll notify you when it’s ready.'
            });
            return;
        }

        const updateData = {};
        if (metadata) {
            updateData.url = urlToUse;
            if (metadata.title) updateData.title = metadata.title;
            // If authors array exists and has more than one author, join for DB field
            if (Array.isArray(metadata.authors) && metadata.authors.length > 1) {
                updateData.author = metadata.authors.join(', ');
            } else if (Array.isArray(metadata.authors) && metadata.authors.length === 1) {
                updateData.author = metadata.authors[0];
            } else if (metadata.author) {
                updateData.author = metadata.author;
            }
            if (metadata.summary) updateData.summary = metadata.summary;
            if (metadata.tags) updateData.tags = JSON.stringify(metadata.tags);
            if (metadata.rating) updateData.rating = metadata.rating;
            if (metadata.wordCount) updateData.wordCount = metadata.wordCount;
            if (metadata.chapters) updateData.chapters = metadata.chapters;
            if (metadata.status) updateData.status = metadata.status;
            if (metadata.language) updateData.language = metadata.language;
            if (metadata.publishedDate) updateData.publishedDate = metadata.publishedDate;
            if (metadata.updatedDate) updateData.updatedDate = metadata.updatedDate;
        }
    if (newTags !== null) updateData.tags = JSON.stringify(newTags);
    if (newNotes !== null) updateData.notes = newNotes;
    if (newUrl) updateData.url = newUrl;
    if (newTitle !== null) updateData.title = newTitle;
    if (newAuthor !== null) updateData.author = newAuthor;
    if (newSummary !== null) updateData.summary = newSummary;
    if (newRating !== null) updateData.rating = newRating;
    if (newStatus !== null) updateData.status = newStatus;
    if (newWordCount !== null) updateData.wordCount = newWordCount;
        if (newAttachment) {
            const { validateAttachment } = require('../../utils/validateAttachment');
            const willBeDeleted = newDeleted !== null ? newDeleted : recommendation.deleted;
            const attachStart = Date.now();
            const validationError = validateAttachment(newAttachment, willBeDeleted);
            if (validationError) {
                await interaction.editReply({
                    content: validationError + '\n\n**And remember:** Only attach files if you\'ve got the author\'s permission. I\'m not running a piracy operation here.'
                });
                console.log(`[rec update] Attachment validation failed (took ${Date.now() - attachStart}ms)`);
                return;
            }
            updateData.attachmentUrl = newAttachment.url;
            await interaction.followUp({
                content: `Alright, file's attached. But listen up - this server has a strict policy about this. You better have the author's explicit permission, because if you don't, the mods are going to remove it faster than you can say "copyright infringement." Don't make me look bad here.`,
                flags: MessageFlags.Ephemeral
            });
            console.log(`[rec update] Attachment followUp sent (took ${Date.now() - attachStart}ms)`);
        }

        const dbStart = Date.now();
        console.log('[rec update] Updating recommendation in DB...');
        await recommendation.update(updateData);
        await recommendation.reload();
        console.log(`[rec update] Recommendation updated and reloaded (DB ops took ${Date.now() - dbStart}ms)`);

                // Build the rec object for the embed utility
                const recForEmbed = {
                    ...recommendation.toJSON(),
                    ...metadata,
                    authors: (metadata && Array.isArray(metadata.authors)) ? metadata.authors : (metadata && metadata.author ? [metadata.author] : [recommendation.author]),
                    id: recommendation.id,
                    url: recommendation.url,
                    recommendedByUsername: recommendation.recommendedByUsername,
                    notes: newNotes !== null ? newNotes : recommendation.notes,
                    // Provide a getParsedTags method for compatibility
                    getParsedTags: function() {
                        if (Array.isArray(newTags) && newTags.length > 0) return newTags;
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
                await interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
        console.error('[rec update] Error:', error);
        await interaction.editReply({
            content: error.message || 'There was an error updating the recommendation. Please try again.'
        });
    }
}

module.exports = handleUpdateRecommendation;
