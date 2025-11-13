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
            id: interaction.options.getInteger('id'),
            find_url: interaction.options.getString('find_url'),
            find_ao3_id: interaction.options.getInteger('find_ao3_id'),
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
        const recId = interaction.options.getInteger('id');
        const findUrl = interaction.options.getString('find_url');
        const findAo3Id = interaction.options.getInteger('find_ao3_id');
        if (!recId && !findUrl && !findAo3Id) {
            await interaction.editReply({
                content: 'You need to provide at least one identifier: `id`, `find_url`, or `find_ao3_id`.'
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

        const recommendation = await findRecommendationByIdOrUrl(interaction, recId, findUrl, findAo3Id);
        if (!recommendation) {
            await interaction.editReply({
                content: `I couldn't find a recommendation with ID ${recId} in our library. Use \`/rec stats\` to see what's available.`
            });
            return;
        }
        let urlToUse = newUrl || recommendation.url;
        urlToUse = normalizeAO3Url(urlToUse);

        // --- Fic Parsing Queue Logic ---
        const { ParseQueue, ParseQueueSubscriber } = require('../../models');
        // Always use the queue for any update that requires a metadata fetch
        const needsMetadataFetch = newUrl || (!newTitle && !newAuthor && !newSummary && !newRating && !newStatus && !newWordCount);
        if (needsMetadataFetch) {
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
                    // Allow manual field updates to bypass cooldown
                    const manualFieldsRequested = newTitle || newAuthor || newSummary || newRating || newStatus || newWordCount || (newTags && newTags.length > 0) || newNotes;
                    const updatedRec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                    if (manualFieldsRequested) {
                        await processRecommendationJob({
                            url: urlToUse,
                            user: { id: interaction.user.id, username: interaction.user.username },
                            manualFields: {
                                title: newTitle,
                                authors: newAuthor ? [newAuthor] : undefined,
                                summary: newSummary,
                                rating: newRating,
                                wordCount: newWordCount,
                                status: newStatus
                            },
                            additionalTags: newTags || [],
                            notes: newNotes || '',
                            isUpdate: true,
                            existingRec: updatedRec || recommendation,
                            notify: async (embed) => {
                                await interaction.editReply({
                                    content: 'This fic was just updated! Here’s the latest info.',
                                    embeds: [embed]
                                });
                            }
                        });
                        return;
                    }
                    // Only enforce cooldown for metadata re-fetches
                    const now = Date.now();
                    let cooldownMsg = '';
                    if (updatedRec && updatedRec.updatedAt) {
                        const cooldownMs = 5 * 60 * 1000; // 5 min cooldown (replace with config if needed)
                        const lastUpdate = new Date(updatedRec.updatedAt).getTime();
                        const timeLeft = Math.max(0, cooldownMs - (now - lastUpdate));
                        if (timeLeft > 0) {
                            const min = Math.floor(timeLeft / 60000);
                            const sec = Math.floor((timeLeft % 60000) / 1000);
                            cooldownMsg = `\nYou can update this fic again in ${min > 0 ? `${min}m ` : ''}${sec}s.`;
                        }
                    }
                    await processRecommendationJob({
                        url: urlToUse,
                        user: { id: interaction.user.id, username: interaction.user.username },
                        manualFields: {},
                        additionalTags: newTags || [],
                        notes: newNotes || '',
                        isUpdate: true,
                        existingRec: updatedRec || recommendation,
                        notify: async (embed) => {
                            await interaction.editReply({
                                content: `This fic was just updated! Here’s the latest info.${cooldownMsg}`,
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
            // Edge case: Only mark as instant_candidate if there are no other pending/processing jobs
            const activeJobs = await ParseQueue.count({ where: { status: ['pending', 'processing'] } });
            const isInstant = activeJobs === 0;
            try {
                queueEntry = await ParseQueue.create({
                    fic_url: urlToUse,
                    status: 'pending',
                    requested_by: interaction.user.id,
                    instant_candidate: isInstant
                });
            } catch (err) {
                // Handle race condition: duplicate key error (Sequelize or raw pg)
                if ((err && err.code === '23505') || (err && err.name === 'SequelizeUniqueConstraintError')) {
                    // Find the now-existing queue entry
                    queueEntry = await ParseQueue.findOne({ where: { fic_url: urlToUse } });
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
                            // Return friendly duplicate message with details, robust fallback
                            let rec = null;
                            try {
                                rec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                            } catch {}
                            let addedBy = rec && rec.recommendedByUsername ? rec.recommendedByUsername : 'someone';
                            let addedAt = rec && rec.createdAt ? new Date(rec.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;
                            let title = rec && rec.title ? rec.title : 'This fic';
                            let msg = `${title} was already added by ${addedBy}${addedAt ? ` on ${addedAt}` : ''}, but hey! Great minds think alike, right?`;
                            if (!rec) msg = 'This fic was already added to the library! Great minds think alike, right?';
                            await interaction.editReply({
                                content: msg
                            });
                            return;
                        } else if (queueEntry.status === 'error') {
                            await interaction.editReply({
                                content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`
                            });
                            return;
                        } else {
                            // Fallback for any other status
                            await interaction.editReply({
                                content: 'This fic is already in the queue. You’ll get a notification when it’s ready!'
                            });
                            return;
                        }
                    }
                }
                throw err;
            }
            await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
            // Poll for instant completion (duration matches suppression threshold in config)
            const { Config } = require('../../models');
            let pollTimeout = 3000; // default 3 seconds
            try {
                const thresholdConfig = await Config.findOne({ where: { key: 'instant_queue_suppress_threshold_ms' } });
                if (thresholdConfig && !isNaN(Number(thresholdConfig.value))) {
                    pollTimeout = Number(thresholdConfig.value);
                }
            } catch {}
            const pollInterval = 200;
            const start = Date.now();
            let foundDone = false;
            let resultEmbed = null;
            while (Date.now() - start < pollTimeout) {
                // Refetch the queue entry
                const updatedQueue = await ParseQueue.findOne({ where: { id: queueEntry.id } });
                if (updatedQueue && updatedQueue.status === 'done' && updatedQueue.result) {
                    // Fetch the updated recommendation for embed
                    const updatedRec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                    if (updatedRec) {
                        const result = await processRecommendationJob({
                            url: urlToUse,
                            user: { id: interaction.user.id, username: interaction.user.username },
                            manualFields: {},
                            additionalTags: newTags || [],
                            notes: newNotes || '',
                            isUpdate: true,
                            existingRec: updatedRec,
                            notify: async (embed) => {
                                resultEmbed = embed;
                            }
                        });
                        if (!resultEmbed && result && result.embed) {
                            resultEmbed = result.embed;
                        }
                    }
                    foundDone = true;
                    break;
                }
                await new Promise(res => setTimeout(res, pollInterval));
            }
            if (foundDone && resultEmbed) {
                await interaction.editReply({
                    content: 'That fic was already updated! Here’s the latest info:',
                    embeds: [resultEmbed]
                });
                return;
            }
            // Final fallback: check if the job is now done in the DB (worker may have been too fast)
            const finalQueue = await ParseQueue.findOne({ where: { id: queueEntry.id, status: 'done' } });
            if (finalQueue && finalQueue.result) {
                const updatedRec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                if (updatedRec) {
                    const result = await processRecommendationJob({
                        url: urlToUse,
                        user: { id: interaction.user.id, username: interaction.user.username },
                        manualFields: {},
                        additionalTags: newTags || [],
                        notes: newNotes || '',
                        isUpdate: true,
                        existingRec: updatedRec
                    });
                    if (result && result.embed) {
                        await interaction.editReply({
                            content: 'That fic was already updated! Here’s the latest info:',
                            embeds: [result.embed]
                        });
                        return;
                    }
                }
            }
            // If still not found, fallback to queue message
            await interaction.editReply({
                content: 'Your fic has been added to the parsing queue! I’ll notify you when it’s ready.'
            });
            return;
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
                authors: newAuthor ? [newAuthor] : undefined,
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
