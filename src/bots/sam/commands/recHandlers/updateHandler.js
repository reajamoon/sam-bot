import findRecommendationByIdOrUrl from '../../../../shared/recUtils/findRecommendationByIdOrUrl.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import processRecommendationJob from '../../../../shared/recUtils/processRecommendationJob.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import { Recommendation } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecommendationEmbed } from '../../../../shared/recUtils/asyncEmbeds.js';
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import { markPrimaryAndNotPrimaryWorks } from './seriesUtils.js';

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

export default async function handleUpdateRecommendation(interaction) {
        // Restrict manual status setting to mods only
        const newStatus = interaction.options.getString('status');
        if (newStatus) {
            // Check for mod permissions (ManageMessages or Administrator)
            const member = interaction.member;
            const isMod = member && (member.permissions.has('ManageMessages') || member.permissions.has('Administrator'));
            if (!isMod) {
                await interaction.editReply({
                    content: 'You do not have permission to manually set fic status. Only moderators can use this option.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }
    try {
        console.log('[rec update] Handler called', {
            user: interaction.user?.id,
            identifier: interaction.options.getString('identifier'),
            options: interaction.options.data
        });

        // Debug: log all incoming option values for troubleshooting
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
        const identifier = interaction.options.getString('identifier');
        if (!identifier) {
            await interaction.editReply({
                content: 'You must provide an identifier (fic ID, AO3 WorkId, or URL).'
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

        const recommendation = await findRecommendationByIdOrUrl(interaction, identifier, null, null);
        if (!recommendation) {
            await interaction.editReply({
                content: `I couldn't find a recommendation with identifier \
\`${identifier}\` in our library. Use \`/rec stats\` to see what's available.`
            });
            return;
        }
        // --- Refactored: Use Series table for batch update of all works in a series ---
        if (recommendation.seriesId) {
            const { Series, Recommendation } = await import('../../../../models/index.js');
            const createOrJoinQueueEntry = (await import('../../../../shared/recUtils/createOrJoinQueueEntry.js')).default;
            const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
            // Fetch the Series entry
            const seriesEntry = await Series.findByPk(recommendation.seriesId);
            if (seriesEntry) {
                const workIds = Array.isArray(seriesEntry.workIds) ? seriesEntry.workIds : [];
                const allWorkUrls = workIds.map(id => `https://archiveofourown.org/works/${id}`);
                const worksInDb = await Recommendation.findAll({ where: { url: allWorkUrls } });
                const worksInDbUrls = new Set(worksInDb.map(w => w.url));
                const newWorkUrls = allWorkUrls.filter(url => !worksInDbUrls.has(url));

                // Fetch AO3 series metadata for up-to-date info
                let seriesMeta = null;
                try {
                    const { fetchAO3SeriesMetadata } = await import('../../../../shared/recUtils/ao3Meta.js');
                    seriesMeta = await fetchAO3SeriesMetadata(seriesEntry.url);
                } catch (err) {
                    console.error('[series update] Failed to fetch AO3 series metadata:', err);
                }
                // Always update the series entry itself (queue)
                await createOrJoinQueueEntry(seriesEntry.url, interaction.user.id);

                // If there are new works, send an ephemeral message listing them (do not import)
                if (newWorkUrls.length > 0) {
                    await interaction.followUp({
                        content: `New works have been added to this series on AO3 since the last update, but have not been imported.\n\n**New works:**\n${newWorkUrls.map(u => `- <${u}>`).join('\n')}`,
                        ephemeral: true
                    });
                }
                // If any works in the series are present in Recommendations, ask if user wants to update all works
                if (worksInDb.length > 0) {
                    // Send ephemeral confirmation prompt
                    await interaction.followUp({
                        content: `There are ${worksInDb.length} works from this series in the library. Would you like to update all of them now?`,
                        ephemeral: true,
                        components: [
                            {
                                type: 1, // ACTION_ROW
                                components: [
                                    {
                                        type: 2, // BUTTON
                                        style: 1, // PRIMARY
                                        custom_id: `update_series_works_${seriesEntry.id}`,
                                        label: 'Update All Works'
                                    }
                                ]
                            }
                        ]
                    });
                }

                // Always send an updated embed for the series
                const embed = await createRecommendationEmbed({
                    ...recommendation.toJSON(),
                    pendingWorks: newWorkUrls
                });
                await interaction.editReply({
                    content: 'Series updated! See below for details.',
                    embeds: [embed]
                });
                return;
            }
        }
        let urlToUse = newUrl || recommendation.url;
        urlToUse = normalizeAO3Url(urlToUse);

        // --- Fic Parsing Queue Logic ---
        const { ParseQueue, ParseQueueSubscriber } = await import('../../../../models/index.js');
        // Always use the queue for any update that requires a metadata fetch
        const needsMetadataFetch = newUrl || (!newTitle && !newAuthor && !newSummary && !newRating && !newStatus && !newWordCount);
        if (needsMetadataFetch) {
            let queueEntry = await ParseQueue.findOne({ where: { fic_url: urlToUse } });
            if (queueEntry) {
                if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
                    const existingSub = await ParseQueueSubscriber.findOne({ where: { queue_id: queueEntry.id, user_id: interaction.user.id } });
                    if (!existingSub) {
                        try {
                            await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
                        } catch (err) {
                            console.error('[RecHandler] Error adding ParseQueueSubscriber:', err, { queue_id: queueEntry.id, user_id: interaction.user.id });
                        }
                    }
                    await interaction.editReply({
                        content: 'That fic is already being processed! You’ll get a notification when it’s ready.'
                    });
                    return;
                } else if (queueEntry.status === 'done' && queueEntry.result) {
                    // For done/cached recs, fetch from DB and build embed directly (no AO3 access)
                    const { Recommendation } = await import('../../../../models/index.js');
                    const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
                    const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                    const updatedRec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                    if (updatedRec) {
                        const recWithSeries = await fetchRecWithSeries(updatedRec.id, true);
                        const embed = await createRecommendationEmbed(recWithSeries);
                        await interaction.editReply({
                            content: 'This fic was just updated! Here’s the latest info.',
                            embeds: [embed]
                        });
                    } else {
                        await interaction.editReply({
                            content: 'Recommendation found in queue but not in database. Please try again or contact an admin.'
                        });
                    }
                    return;
                } else if (queueEntry.status === 'error') {
                    await interaction.editReply({
                        content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`
                    });
                    return;
                }
            }
            // Only mark as instant_candidate if this is a single non-series fic and no other jobs are active
            const activeJobs = await ParseQueue.count({ where: { status: ['pending', 'processing'] } });
            let isInstant = false;
            // Only allow instant_candidate for non-series URLs
            if (!/archiveofourown\.org\/series\//.test(urlToUse) && activeJobs === 0) {
                isInstant = true;
            }
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
                                try {
                                    await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
                                } catch (err) {
                                    console.error('[RecHandler] Error adding ParseQueueSubscriber (race condition):', err, { queue_id: queueEntry.id, user_id: interaction.user.id });
                                }
                            }
                            await interaction.editReply({
                                content: 'That fic is already being processed! You’ll get a notification when it’s ready.'
                            });
                            return;
                        } else if (queueEntry.status === 'done' && queueEntry.result) {
                            // Return friendly duplicate message with details, robust fallback
                            let rec = null;
                            try {
                                const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                                rec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                            } catch {}
                            let recWithSeries = rec;
                            if (rec) {
                                recWithSeries = await fetchRecWithSeries(rec.id, true);
                            }
                            let addedBy = recWithSeries && recWithSeries.recommendedByUsername ? recWithSeries.recommendedByUsername : 'someone';
                            let addedAt = recWithSeries && recWithSeries.createdAt ? new Date(recWithSeries.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;
                            let title = recWithSeries && recWithSeries.title ? recWithSeries.title : 'This fic';
                            let msg = `${title} was already added by ${addedBy}${addedAt ? ` on ${addedAt}` : ''}, but hey! Great minds think alike, right?`;
                            if (!recWithSeries) msg = 'This fic was already added to the library! Great minds think alike, right?';
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
            try {
                await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
            } catch (err) {
                console.error('[RecHandler] Error adding ParseQueueSubscriber (final unconditional):', err, { queue_id: queueEntry.id, user_id: interaction.user.id });
            }
            // Poll for instant completion (duration matches suppression threshold in config)
            const { Config } = await import('../../../../models/index.js');
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
                            // Fetch the updated recommendation for embed (no AO3 access)
                            const { Recommendation } = await import('../../../../models/index.js');
                            const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
                            const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                            const updatedRec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                            if (updatedRec) {
                                const recWithSeries = await fetchRecWithSeries(updatedRec.id, true);
                                resultEmbed = await createRecommendationEmbed(recWithSeries);
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
                const { Recommendation } = await import('../../../../models/index.js');
                const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
                const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                const updatedRec = await findRecommendationByIdOrUrl(interaction, recId, urlToUse, null);
                if (updatedRec) {
                    const recWithSeries = await fetchRecWithSeries(updatedRec.id, true);
                    const embed = await createRecommendationEmbed(recWithSeries);
                    await interaction.editReply({
                        content: 'That fic was already updated! Here’s the latest info:',
                        embeds: [embed]
                    });
                    return;
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
            if (Array.isArray(recommendation.additionalTags)) {
                oldAdditional = recommendation.additionalTags;
            } else if (typeof recommendation.additionalTags === 'string') {
                try { oldAdditional = JSON.parse(recommendation.additionalTags); } catch { oldAdditional = []; }
            }
            let mainTags = [];
            if (Array.isArray(recommendation.tags)) {
                mainTags = recommendation.tags;
            } else if (typeof recommendation.tags === 'string') {
                try { mainTags = JSON.parse(recommendation.tags); } catch { mainTags = recommendation.tags.split(',').map(t => t.trim()).filter(Boolean); }
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
