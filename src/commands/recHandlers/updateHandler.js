const findRecommendationByIdOrUrl = require('../../utils/recUtils/findRecommendationByIdOrUrl');
const { MessageFlags } = require('discord.js');
const isValidFanficUrl = require('../../utils/recUtils/isValidFanficUrl');
const processRecommendationJob = require('../../utils/recUtils/processRecommendationJob');

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
    try {
        await interaction.deferReply();

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

        const recommendation = await findRecommendationByIdOrUrl(interaction, recId, findUrl, findAo3Id);
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

        // --- Fic Parsing Queue Logic ---
        const { ParseQueue, ParseQueueSubscriber } = require('../../models');
        if (newUrl || (!newUrl && !newTags && !newNotes && !newTitle && !newAuthor && !newSummary && !newRating && !newStatus && !newWordCount)) {
            let queueEntry = await ParseQueue.findOne({ where: { fic_url: urlToUse } });
            if (queueEntry) {
                if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
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
                    await processRecommendationJob({
                        url: urlToUse,
                        user: { id: interaction.user.id, username: interaction.user.username },
                        manualFields: {},
                        additionalTags: newTags || [],
                        notes: newNotes || '',
                        isUpdate: true,
                        existingRec: recommendation,
                        notify: async (embed) => {
                            await interaction.editReply({
                                content: 'This fic was already parsed! Here are the details:',
                                embeds: [embed]
                            });
                        }
                    });
                    return;
                } else if (queueEntry.status === 'error') {
                    await interaction.editReply({
                        content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`
                    });
                    return;
                }
            }
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

        // If not queueing, update the recommendation directly
        await processRecommendationJob({
            url: urlToUse,
            user: { id: interaction.user.id, username: interaction.user.username },
            manualFields: {
                title: newTitle,
                author: newAuthor,
                summary: newSummary,
                rating: newRating,
                wordCount: newWordCount,
                status: newStatus
            },
            additionalTags: newTags || [],
            notes: newNotes || '',
            isUpdate: true,
            existingRec: recommendation,
            notify: async (embedOrError) => {
                if (embedOrError && embedOrError.error) {
                    let msg = '';
                    if (embedOrError.error === 'Site protection detected. Manual entry required.') {
                        msg = 'Site protection is blocking metadata fetch. Please enter details manually.';
                    } else if (embedOrError.error === '404_not_found') {
                        msg = 'Story not found (404). The link may be broken or deleted.';
                    } else if (embedOrError.error === '403_forbidden') {
                        msg = 'Access restricted (403). You may need to log in to view this story.';
                    } else if (embedOrError.error === 'connection_error') {
                        msg = 'Connection error. The site may be down or unreachable.';
                    } else {
                        msg = embedOrError.error;
                    }
                    await interaction.editReply({ content: msg });
                } else {
                    await interaction.editReply({ content: null, embeds: [embedOrError] });
                }
            }
        });
    } catch (error) {
        console.error('[rec update] Error:', error);
        await interaction.editReply({
            content: error.message || 'There was an error updating the recommendation. Please try again.'
        });
    }
}

module.exports = handleUpdateRecommendation;
