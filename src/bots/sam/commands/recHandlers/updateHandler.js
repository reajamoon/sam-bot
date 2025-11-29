import findRecommendationByIdOrUrl from '../../../../shared/recUtils/findRecommendationByIdOrUrl.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import processRecommendationJob from '../../../../shared/recUtils/processRecommendationJob.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import { Recommendation, UserFicMetadata } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecommendationEmbed } from '../../../../shared/recUtils/asyncEmbeds.js';
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import { markPrimaryAndNotPrimaryWorks } from './seriesUtils.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { setModLock } from '../../../../shared/utils/modLockUtils.js';
import { isFieldGloballyModlocked } from '../../../../shared/modlockUtils.js';
import { getLockedFieldsForRec } from '../../../../shared/getLockedFieldsForRec.js';

// Helper to deduplicate and lowercase tags
function cleanTags(tags) {
    if (!tags) return [];
    return Array.from(new Set(tags.map(t => t.toLowerCase().trim()).filter(Boolean)));
}

// Helper to upsert UserFicMetadata
async function upsertUserFicMetadata({ userID, ao3ID, seriesId, newTitle, newAuthor, newSummary, newTags, newRating, newWordCount, newChapters, newStatus, newArchiveWarnings, newSeriesName, newSeriesPart, newSeriesUrl, additionalTagsToSend, newNotes }) {
    await UserFicMetadata.upsert({
        userID,
        ao3ID,
        seriesId,
        manual_title: newTitle || null,
        manual_authors: newAuthor ? [newAuthor] : null,
        manual_summary: newSummary || null,
        manual_tags: cleanTags(newTags),
        manual_rating: newRating || null,
        manual_wordcount: newWordCount || null,
        manual_chapters: newChapters || null,
        manual_status: newStatus || null,
        manual_archive_warnings: cleanTags(newArchiveWarnings),
        manual_seriesName: newSeriesName || null,
        manual_seriesPart: newSeriesPart || null,
        manual_seriesUrl: newSeriesUrl || null,
        additional_tags: cleanTags(additionalTagsToSend),
        rec_note: newNotes || null
    });
}

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
    // Defer reply since this operation may take time
    await interaction.deferReply();
    
    // Extract identifier from interaction options
    const identifier = interaction.options.getString('identifier');
    
    // --- ModLock enforcement (per-rec and global) ---
    let modLocksByField = {};
    // Fetch the recommendation to get its ID (if not already fetched)
    let recommendation = null;
    if (!recommendation) {
      // Try to get identifier from interaction (id, url, etc.)
      // This assumes you fetch the rec later as in your code, so you can move this block after fetching if needed
      // For now, just set modLocksByField after fetching recommendation
    }
    // After fetching recommendation, get per-rec locks and merge with global locks
    // (Move this block after you fetch the rec if needed)
    // Example usage after fetching rec:
    //   const lockedFields = await getLockedFieldsForRec(recommendation.id);
    //   for (const field of lockedFields) modLocksByField[field] = true;
    //   // Add global modlocks
    //   const allFields = [...];
    //   for (const field of allFields) if (await isFieldGloballyModlocked(field)) modLocksByField[field] = true;
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
    let newUrl = interaction.options.getString('new_url');
    if (newUrl) newUrl = normalizeAO3Url(newUrl);
    const newTitle = interaction.options.getString('title');
    const newAuthor = interaction.options.getString('author');
    const newSummary = interaction.options.getString('summary');
    let newRating = interaction.options.getString('rating');
    newRating = normalizeRating(newRating);
    // newStatus already defined above
    const newWordCount = interaction.options.getInteger('wordcount');
    const newDeleted = interaction.options.getBoolean('deleted');
    const newAttachment = interaction.options.getAttachment('attachment');
    let newTags = cleanTags(
        interaction.options.getString('tags')
            ? interaction.options.getString('tags').split(',')
            : []
    );
    const newNotes = interaction.options.getString('notes');
    const newChapters = interaction.options.getString('chapters');
    let newArchiveWarnings = cleanTags(
        interaction.options.getString('archive_warnings')
            ? interaction.options.getString('archive_warnings').split(',')
            : []
    );
    const newSeriesName = interaction.options.getString('series_name');
    const newSeriesPart = interaction.options.getInteger('series_part');
    const newSeriesUrl = interaction.options.getString('series_url');
    // Support append mode for additional tags
    const appendAdditional = interaction.options.getBoolean('append');

    try {
        const recommendation = await findRecommendationByIdOrUrl(interaction, identifier, null, null);
        if (!recommendation) {
            await interaction.editReply({
                content: `I couldn't find a recommendation with identifier \`${identifier}\` in our library. Use \`/rec stats\` to see what's available.`
            });
            return;
        }
        
        // Set up additional tags to send
        let additionalTagsToSend = newTags;
        
        // Determine URL to use for processing (new URL if provided, otherwise existing URL)
        const urlToUse = newUrl || recommendation.url;
        if (!recommendation) {
            await interaction.editReply({
                content: `I couldn't find a recommendation with identifier \`${identifier}\` in our library. Use \`/rec stats\` to see what's available.`
            });
            return;
        }
        // --- Refactored: Use Series table for batch update of all works in a series ---
        if (recommendation.seriesId) {
            const { Series, Recommendation } = await import('../../../../models/index.js');
            const createOrJoinQueueEntry = (await import('../../../../shared/recUtils/createOrJoinQueueEntry.js')).default;
            const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
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
                    }
                    if (queueEntry.status === 'done' && queueEntry.result) {
                        // For done/cached recs, fetch from DB and build embed directly (no AO3 access)
                        const { Recommendation } = await import('../../../../models/index.js');
                        const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
                        const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                        const updatedRec = await findRecommendationByIdOrUrl(interaction, recommendation.id, urlToUse, null);
                        if (updatedRec) {
                            const recWithSeries = await fetchRecWithSeries(updatedRec.id, true);
                            const embed = await createRecommendationEmbed(recWithSeries);
                            await interaction.editReply({
                                content: 'This fic was just updated! Here’s the latest info.',
                                embeds: [embed]
                            });
                            // Upsert UserFicMetadata after successful instant update
                            if (recommendation.seriesId) {
                              await UserFicMetadata.upsert({
                                userID: interaction.user.id,
                                ao3ID: null,
                                seriesId: recommendation.seriesId,
                                manual_title: newTitle || null,
                                manual_authors: newAuthor ? [newAuthor] : null,
                                manual_summary: newSummary || null,
                                manual_tags: newTags || [],
                                manual_rating: newRating || null,
                                manual_wordcount: newWordCount || null,
                                manual_chapters: newChapters || null,
                                manual_status: newStatus || null,
                                manual_archive_warnings: newArchiveWarnings || [],
                                manual_seriesName: newSeriesName || null,
                                manual_seriesPart: newSeriesPart || null,
                                manual_seriesUrl: newSeriesUrl || null,
                                additional_tags: additionalTagsToSend || [],
                                rec_note: newNotes || null
                              });
                            } else {
                              await UserFicMetadata.upsert({
                                userID: interaction.user.id,
                                ao3ID: recommendation.ao3ID,
                                seriesId: recommendation.seriesId || null,
                                manual_title: newTitle || null,
                                manual_authors: newAuthor ? [newAuthor] : null,
                                manual_summary: newSummary || null,
                                manual_tags: newTags || [],
                                manual_rating: newRating || null,
                                manual_wordcount: newWordCount || null,
                                manual_chapters: newChapters || null,
                                manual_status: newStatus || null,
                                manual_archive_warnings: newArchiveWarnings || [],
                                manual_seriesName: newSeriesName || null,
                                manual_seriesPart: newSeriesPart || null,
                                manual_seriesUrl: newSeriesUrl || null,
                                additional_tags: additionalTagsToSend || [],
                                rec_note: newNotes || null
                              });
                            }
                        } else {
                            await interaction.editReply({
                                content: 'Recommendation found in queue but not in database. Please try again or contact an admin.'
                            });
                        }
                        return;
                    }
                    if (queueEntry.status === 'error') {
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
                        instant_candidate: isInstant,
                        notes: newNotes || null,
                        additional_tags: JSON.stringify(additionalTagsToSend || [])
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
                            }
                            if (queueEntry.status === 'done' && queueEntry.result) {
                                // Return friendly duplicate message with details, robust fallback
                                let rec = null;
                                try {
                                    const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                                    rec = await findRecommendationByIdOrUrl(interaction, recommendation.id, urlToUse, null);
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
                            }
                            if (queueEntry.status === 'error') {
                                await interaction.editReply({
                                    content: `There was an error parsing this fic previously: ${queueEntry.error_message || 'Unknown error.'} You can try again later.`
                                });
                                return;
                            }
                            // Fallback for any other status
                            await interaction.editReply({
                                content: 'This fic is already in the queue. You’ll get a notification when it’s ready!'
                            });
                            return;
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
                        const updatedRec = await findRecommendationByIdOrUrl(interaction, recommendation.id, urlToUse, null);
                        if (updatedRec) {
                            const recWithSeries = await fetchRecWithSeries(updatedRec.id, true);
                            resultEmbed = await createRecommendationEmbed(recWithSeries);
                            // Upsert UserFicMetadata after successful instant update
                            if (recommendation.seriesId) {
                              await UserFicMetadata.upsert({
                                userID: interaction.user.id,
                                ao3ID: null,
                                seriesId: recommendation.seriesId,
                                manual_title: newTitle || null,
                                manual_authors: newAuthor ? [newAuthor] : null,
                                manual_summary: newSummary || null,
                                manual_tags: newTags || [],
                                manual_rating: newRating || null,
                                manual_wordcount: newWordCount || null,
                                manual_chapters: newChapters || null,
                                manual_status: newStatus || null,
                                manual_archive_warnings: newArchiveWarnings || [],
                                manual_seriesName: newSeriesName || null,
                                manual_seriesPart: newSeriesPart || null,
                                manual_seriesUrl: newSeriesUrl || null,
                                additional_tags: additionalTagsToSend || [],
                                rec_note: newNotes || null
                              });
                            } else {
                              await UserFicMetadata.upsert({
                                userID: interaction.user.id,
                                ao3ID: recommendation.ao3ID,
                                seriesId: recommendation.seriesId || null,
                                manual_title: newTitle || null,
                                manual_authors: newAuthor ? [newAuthor] : null,
                                manual_summary: newSummary || null,
                                manual_tags: newTags || [],
                                manual_rating: newRating || null,
                                manual_wordcount: newWordCount || null,
                                manual_chapters: newChapters || null,
                                manual_status: newStatus || null,
                                manual_archive_warnings: newArchiveWarnings || [],
                                manual_seriesName: newSeriesName || null,
                                manual_seriesPart: newSeriesPart || null,
                                manual_seriesUrl: newSeriesUrl || null,
                                additional_tags: additionalTagsToSend || [],
                                rec_note: newNotes || null
                              });
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
                    const { Recommendation } = await import('../../../../models/index.js');
                    const { createRecommendationEmbed } = await import('../../../../shared/recUtils/asyncEmbeds.js');
                    const { fetchRecWithSeries } = await import('../../../../models/fetchRecWithSeries.js');
                    const updatedRec = await findRecommendationByIdOrUrl(interaction, recommendation.id, urlToUse, null);
                    if (updatedRec) {
                        const recWithSeries = await fetchRecWithSeries(updatedRec.id, true);
                        const embed = await createRecommendationEmbed(recWithSeries);
                        await interaction.editReply({
                            content: 'That fic was already updated! Here’s the latest info:',
                            embeds: [embed]
                        });
                        // Upsert UserFicMetadata after successful instant update
                        if (recommendation.seriesId) {
                          await UserFicMetadata.upsert({
                            userID: interaction.user.id,
                            ao3ID: null,
                            seriesId: recommendation.seriesId,
                            manual_title: newTitle || null,
                            manual_authors: newAuthor ? [newAuthor] : null,
                            manual_summary: newSummary || null,
                            manual_tags: newTags || [],
                            manual_rating: newRating || null,
                            manual_wordcount: newWordCount || null,
                            manual_chapters: newChapters || null,
                            manual_status: newStatus || null,
                            manual_archive_warnings: newArchiveWarnings || [],
                            manual_seriesName: newSeriesName || null,
                            manual_seriesPart: newSeriesPart || null,
                            manual_seriesUrl: newSeriesUrl || null,
                            additional_tags: additionalTagsToSend || [],
                            rec_note: newNotes || null
                          });
                        } else {
                          await UserFicMetadata.upsert({
                            userID: interaction.user.id,
                            ao3ID: recommendation.ao3ID,
                            seriesId: recommendation.seriesId || null,
                            manual_title: newTitle || null,
                            manual_authors: newAuthor ? [newAuthor] : null,
                            manual_summary: newSummary || null,
                            manual_tags: newTags || [],
                            manual_rating: newRating || null,
                            manual_wordcount: newWordCount || null,
                            manual_chapters: newChapters || null,
                            manual_status: newStatus || null,
                            manual_archive_warnings: newArchiveWarnings || [],
                            manual_seriesName: newSeriesName || null,
                            manual_seriesPart: newSeriesPart || null,
                            manual_seriesUrl: newSeriesUrl || null,
                            additional_tags: additionalTagsToSend || [],
                            rec_note: newNotes || null
                          });
                        }
                        return;
                    }
                }
                // If still not found, fallback to queue message
                await interaction.editReply({
                    content: 'Your fic has been added to the parsing queue! I’ll notify you when it’s ready.'
                });
                return;
            }

        }
        
        // For individual recommendation updates, also use the queue system
        // (Sam should never call AO3 directly - that's Jack's job)
        const { ParseQueue, ParseQueueSubscriber } = await import('../../../../models/index.js');
        
        // Check if already in queue
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
                    content: "That fic is already being processed! You'll get a notification when it's ready."
                });
                return;
            }
        }
        
        // Create new queue entry for Jack to process
        const activeJobs = await ParseQueue.count({ where: { status: ['pending', 'processing'] } });
        let isInstant = false;
        if (!/archiveofourown\.org\/series\//.test(urlToUse) && activeJobs === 0) {
            isInstant = true;
        }
        
        try {
            queueEntry = await ParseQueue.create({
                fic_url: urlToUse,
                status: 'pending',
                requested_by: interaction.user.id,
                instant_candidate: isInstant,
                notes: newNotes || null,
                additional_tags: JSON.stringify(additionalTagsToSend || [])
            });
        } catch (err) {
            // Handle race condition
            if ((err && err.code === '23505') || (err && err.name === 'SequelizeUniqueConstraintError')) {
                queueEntry = await ParseQueue.findOne({ where: { fic_url: urlToUse } });
                if (queueEntry && (queueEntry.status === 'pending' || queueEntry.status === 'processing')) {
                    await interaction.editReply({
                        content: "That fic is already being processed! You'll get a notification when it's ready."
                    });
                    return;
                }
            }
            throw err;
        }
        
        try {
            await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
        } catch (err) {
            console.error('[RecHandler] Error adding ParseQueueSubscriber:', err, { queue_id: queueEntry.id, user_id: interaction.user.id });
        }
        
        await interaction.editReply({
            content: "Your fic update has been added to the parsing queue! I'll notify you when it's ready."
        });
        
        // Store user's manual field inputs for Jack to use
        await upsertUserFicMetadata({
            userID: interaction.user.id,
            ao3ID: recommendation.ao3ID,
            seriesId: recommendation.seriesId || null,
            newTitle,
            newAuthor,
            newSummary,
            newTags,
            newRating,
            newWordCount,
            newChapters,
            newStatus,
            newArchiveWarnings,
            newSeriesName,
            newSeriesPart,
            newSeriesUrl,
            additionalTagsToSend,
            newNotes
        });
    } catch (error) {
        console.error('[rec update] Error:', error);
        await interaction.editReply({
            content: error.message || 'There was an error updating the recommendation. Please try again.'
        });
    }
}
