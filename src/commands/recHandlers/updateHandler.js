const updateMessages = require('./updateMessages');
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
        console.log('[rec update] Handler called', {
            user: interaction.user?.id,
            identifier: interaction.options.getString('identifier'),
            options: interaction.options.data
        });

        // Debug: log all incoming option values for troubleshooting//
        const debugFields = {
            newTitle: interaction.options.getString('title'),
            newAuthor: interaction.options.getString('author'),
            newSummary: interaction.options.getString('summary'),
            newRating: interaction.options.getString('rating'),
            newStatus: interaction.options.getString('status'),
            newWordCount: interaction.options.getInteger('wordcount'),
            newTags: interaction.options.getString('tags'),
            newNotes: interaction.options.getString('notes'),
            appendAdditional: interaction.options.getBoolean('append')
        };
        console.log('[rec update] Option values:', debugFields);
        await interaction.deferReply();

        const normalizeAO3Url = require('../../utils/recUtils/normalizeAO3Url');
        const identifier = interaction.options.getString('identifier');
        let recId = null, findUrl = null, findAo3Id = null;
        if (identifier) {
            // URL detection
            if (/^https?:\/\//i.test(identifier)) {
                findUrl = identifier;
            } else if (/^\d{5,}$/.test(identifier)) {
                // AO3 WorkId: 5+ digits
                findAo3Id = parseInt(identifier, 10);
            } else if (/^\d+$/.test(identifier)) {
                // Internal fic ID: all digits
                recId = parseInt(identifier, 10);
            } else {
                // fallback: try as URL
                findUrl = identifier;
            }
        }
        if (!recId && !findUrl && !findAo3Id) {
            await interaction.editReply({
                content: updateMessages.needIdentifier
            });
            return;
        }
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
        // Robust tag parsing and deduplication
        let newTags = interaction.options.getString('tags')
            ? interaction.options.getString('tags').split(',').map(tag => tag.trim()).filter(Boolean)
            : null;
        if (newTags) {
            newTags = Array.from(new Set(newTags.map(t => t.toLowerCase())));
        }
    const newNotes = interaction.options.getString('notes');
    // Support append mode for additional tags
    const appendAdditional = interaction.options.getBoolean('append');

        console.log('[rec update] Calling findRecommendationByIdOrUrl with:', {
            recId,
            findUrl,
            findAo3Id
        });
        const recommendation = await findRecommendationByIdOrUrl(interaction, recId, findUrl, findAo3Id);
        if (!recommendation) {
            await interaction.editReply({
                content: updateMessages.notFound(recId)
            });
            return;
        }
        let urlToUse = newUrl || recommendation.url;
        urlToUse = normalizeAO3Url(urlToUse);

        // --- Fic Parsing Queue Logic ---
        const createOrJoinQueueEntry = require('../../utils/recUtils/createOrJoinQueueEntry');
        // Always use the queue for any update that requires a metadata fetch
        // Determine which update logic to use
        const hasTitle = typeof newTitle === 'string' && newTitle.trim().length > 0;
        const hasAuthor = typeof newAuthor === 'string' && newAuthor.trim().length > 0;
        const hasManualFields = [newSummary, newRating, newStatus]
            .some(f => typeof f === 'string' && f.trim().length > 0)
            || (typeof newWordCount === 'number' && !isNaN(newWordCount))
            || (Array.isArray(newTags) && newTags.length > 0)
            || (typeof newNotes === 'string' && newNotes.trim().length > 0);

        let updateMode = 'fetch';
        if (newUrl) {
            updateMode = 'fetch'; // Always fetch for new URL
        } else if (hasTitle && hasAuthor) {
            updateMode = 'manualOnly'; // Override fetch, update only manual fields
        } else if ((hasTitle || hasAuthor || hasManualFields)) {
            updateMode = 'manualAndFetch'; // Update manual fields and fetch
        } else {
            updateMode = 'fetchOnlyOrCooldown'; // Only ID/URL provided
        }
        // --- Main update logic by updateMode ---
        if (updateMode === 'fetch' || updateMode === 'manualAndFetch' || updateMode === 'fetchOnlyOrCooldown') {
            // Use modular queue utility for queue entry creation/join/lookup
            const { queueEntry, status, message } = await createOrJoinQueueEntry(urlToUse, interaction.user.id);

            if (status === 'processing') {
                await interaction.editReply({
                    content: message || updateMessages.alreadyProcessing
                });
                return;
            } else if (status === 'done' && queueEntry.result) {
                let resultEmbed = null;
                let resultObj = await processRecommendationJob({
                    url: urlToUse,
                    user: { id: interaction.user.id, username: interaction.user.username },
                    manualFields: {
                        title: newTitle,
                        author: newAuthor,
                        summary: newSummary,
                        rating: newRating,
                        wordCount: newWordCount,
                        status: newStatus,
                        notes: newNotes || ''
                    },
                    additionalTags: newTags || [],
                    notes: newNotes || '',
                    isUpdate: true,
                    existingRec: recommendation,
                    notify: async (embed) => {
                        resultEmbed = embed;
                    }
                });
                if (resultEmbed) {
                    await interaction.editReply({
                        content: updateMessages.updateSuccess,
                        embeds: [resultEmbed]
                    });
                } else {
                    await interaction.editReply({
                        content: updateMessages.updateNoEmbed
                    });
                }
                return;
            } else if (status === 'error') {
                await interaction.editReply({
                    content: message || updateMessages.errorPreviously
                });
                return;
            } else if (status === 'created') {
                if (newNotes || (newTags && newTags.length > 0)) {
                    await queueEntry.update({
                        notes: newNotes || '',
                        additional_tags: JSON.stringify(newTags || [])
                    });
                }
                await interaction.editReply({
                    content: updateMessages.addedToQueue
                });
                return;
            } else {
                await interaction.editReply({
                    content: message || updateMessages.alreadyInQueue
                });
                return;
            }
        }

        // If not queueing, update the recommendation directly
        // For additional tags, support append or replace
        let additionalTagsToSend = newTags || [];
        if (appendAdditional && newTags && newTags.length > 0) {
            // Merge with all existing tags (main + additional), deduplicate
            let oldAdditional = [];
            try { oldAdditional = JSON.parse(recommendation.additionalTags || '[]'); } catch { oldAdditional = []; }
            let mainTags = [];
            if (recommendation.tags) {
                if (Array.isArray(recommendation.tags)) {
                    mainTags = recommendation.tags;
                } else if (typeof recommendation.tags === 'string') {
                    mainTags = recommendation.tags.split(',').map(t => t.trim()).filter(Boolean);
                }
            }
            additionalTagsToSend = Array.from(new Set([
                ...mainTags.map(t => t.toLowerCase()),
                ...oldAdditional.map(t => t.toLowerCase()),
                ...newTags.map(t => t.toLowerCase())
            ]));
        }
        // Always deduplicate and clean
        additionalTagsToSend = Array.from(new Set((additionalTagsToSend || []).map(t => t.toLowerCase())));
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
            additionalTags: additionalTagsToSend,
            notes: newNotes || '',
            isUpdate: true,
            existingRec: recommendation,
            notify: async (embedOrError) => {
                if (embedOrError && embedOrError.error) {
                    let msg = '';
                    if (embedOrError.error === 'Site protection detected. Manual entry required.') {
                        msg = updateMessages.siteProtection;
                    } else if (embedOrError.error === '404_not_found') {
                        msg = updateMessages.notFound404;
                    } else if (embedOrError.error === '403_forbidden') {
                        msg = updateMessages.forbidden403;
                    } else if (embedOrError.error === 'connection_error') {
                        msg = updateMessages.connectionError;
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
            content: error.message || updateMessages.genericError
        });
    }
}

module.exports = handleUpdateRecommendation;
