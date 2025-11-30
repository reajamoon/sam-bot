import findRecommendationByIdOrUrl from '../../../../shared/recUtils/findRecommendationByIdOrUrl.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import { saveUserMetadata, detectSiteAndExtractIDs } from '../../../../shared/recUtils/processUserMetadata.js';
import { Recommendation } from '../../../../models/index.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecEmbed } from '../../../../shared/recUtils/createRecEmbed.js';
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import { markPrimaryAndNotPrimaryWorks } from './seriesUtils.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { setModLock } from '../../../../shared/utils/modLockUtils.js';
import { isFieldGloballyModlockedFor } from '../../../../shared/modlockUtils.js';
import { getLockedFieldsForRec } from '../../../../shared/getLockedFieldsForRec.js';
import handleUpdateSeries from './seriesUpdateHandler.js';

// Helper to deduplicate and lowercase tags
function cleanTags(tags) {
    if (!tags) return [];
    return Array.from(new Set(tags.map(t => t.toLowerCase().trim()).filter(Boolean)));
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
    
    // Check if this is a series identifier and route accordingly
    if (/^S\d+$/i.test(identifier) || /^https?:\/\/.*archiveofourown\.org\/series\/\d+/.test(identifier)) {
        return await handleUpdateSeries(interaction, identifier);
    }
    
    // Otherwise, handle as recommendation update
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
    // Get the available fields from the command options
    const newTitle = interaction.options.getString('title');
    const newAuthor = interaction.options.getString('author');
    const newSummary = interaction.options.getString('summary');
    let newRating = interaction.options.getString('rating');
    newRating = normalizeRating(newRating);
    // newStatus already defined above
    const newWordCount = interaction.options.getInteger('wordcount');
    const newTags = cleanTags(
        interaction.options.getString('tags')
            ? interaction.options.getString('tags').split(',')
            : []
    );
    const newNotes = interaction.options.getString('notes');
    const deleted = interaction.options.getBoolean('deleted');
    const newAttachment = interaction.options.getAttachment('attachment');
    const manualOnly = interaction.options.getBoolean('manual_only');

    try {
        const recommendation = await findRecommendationByIdOrUrl(interaction, identifier, null, null);
        if (!recommendation) {
            await interaction.editReply({
                content: `I couldn't find a recommendation with identifier \`${identifier}\` in our library. Use \`/rec stats\` to see what's available.`
            });
            return;
        }

        // --- Build modlock restrictions ---
        // Per-rec locks apply to both manual and queue modes
        const perRecLockedFields = await getLockedFieldsForRec(recommendation, interaction.user);
        // Global locks only apply to manual updates, not Jack processing
        const globalLockedFields = new Set();
        if (manualOnly) {
            const allFields = [
                'title', 'author', 'summary', 'rating', 'wordCount', 'status',
                'tags', 'notes', 'deleted', 'attachment'
            ];
            for (const field of allFields) {
                if (await isFieldGloballyModlockedFor(interaction.user, field)) {
                    globalLockedFields.add(field);
                }
            }
        }

        // Helper function to check if field is locked for manual updates
        const isFieldLocked = (fieldName) => {
            return perRecLockedFields.has(fieldName) ||
                   perRecLockedFields.has('ALL') ||
                   (manualOnly && globalLockedFields.has(fieldName));
        };

        // Determine URL to use for processing
        const urlToUse = recommendation.url;

        // Validation for attachment/deleted logic
        if (newAttachment) {
            const attachmentError = validateAttachment(newAttachment, deleted || recommendation.deleted);
            if (attachmentError) {
                await interaction.editReply({
                    content: attachmentError,
                    ephemeral: true
                });
                return;
            }
        }

        // Save user metadata immediately (before any queue processing)
        // Build manual fields object
        const manualFields = {};
        if (newTitle) manualFields.title = newTitle;
        if (newAuthor) manualFields.author = newAuthor;
        if (newSummary) manualFields.summary = newSummary;
        if (newRating) manualFields.rating = newRating;
        if (newWordCount) manualFields.wordCount = newWordCount;
        if (newStatus) manualFields.status = newStatus;
        if (deleted !== null) manualFields.deleted = deleted;
        if (newAttachment) manualFields.attachment = newAttachment;
        if (newNotes) manualFields.notes = newNotes;
        if (newTags.length > 0) manualFields.tags = newTags;

        await saveUserMetadata({
            url: urlToUse,
            user: interaction.user,
            notes: newNotes || '',
            additionalTags: newTags || [],
            manualFields
        });

        // For non-manual_only mode: use the queue system (current behavior)
        // Only skip queue if manual_only is explicitly set to true
        if (!manualOnly) {
            // Normal mode: use queue system for metadata fetching
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
            const isSeriesUrl = /archiveofourown\.org\/series\//.test(urlToUse);
            if (!isSeriesUrl && activeJobs === 0) {
                isInstant = true;
            }

            try {
                queueEntry = await ParseQueue.create({
                    fic_url: urlToUse,
                    status: 'pending',
                    requested_by: interaction.user.id,
                    instant_candidate: isInstant,
                    batch_type: isSeriesUrl ? 'series' : null
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
        } else {
            // Manual-only mode: apply only the provided fields directly, no queue
            // Respect both per-rec locks and global locks
            const updateFields = {};
            let hasUpdates = false;
            const blockedFields = [];

            // Check each field against locks before adding to updateFields
            if (newTitle) {
                if (!isFieldLocked('title')) {
                    updateFields.title = newTitle;
                    hasUpdates = true;
                } else {
                    blockedFields.push('title');
                }
            }

            if (newAuthor) {
                if (!isFieldLocked('author')) {
                    updateFields.author = newAuthor;
                    hasUpdates = true;
                } else {
                    blockedFields.push('author');
                }
            }

            if (newSummary) {
                if (!isFieldLocked('summary')) {
                    updateFields.summary = newSummary;
                    hasUpdates = true;
                } else {
                    blockedFields.push('summary');
                }
            }

            if (newRating) {
                if (!isFieldLocked('rating')) {
                    updateFields.rating = newRating;
                    hasUpdates = true;
                } else {
                    blockedFields.push('rating');
                }
            }

            if (newWordCount) {
                if (!isFieldLocked('wordCount')) {
                    updateFields.wordCount = newWordCount;
                    hasUpdates = true;
                } else {
                    blockedFields.push('wordCount');
                }
            }

            if (newStatus) {
                if (!isFieldLocked('status')) {
                    updateFields.status = newStatus;
                    hasUpdates = true;
                } else {
                    blockedFields.push('status');
                }
            }

            if (deleted !== null) {
                if (!isFieldLocked('deleted')) {
                    updateFields.deleted = deleted;
                    hasUpdates = true;
                } else {
                    blockedFields.push('deleted');
                }
            }

            if (newAttachment) {
                if (!isFieldLocked('attachment')) {
                    updateFields.attachment = newAttachment.url;
                    hasUpdates = true;
                } else {
                    blockedFields.push('attachment');
                }
            }

            if (newNotes) {
                if (!isFieldLocked('notes')) {
                    updateFields.notes = newNotes;
                    hasUpdates = true;
                } else {
                    blockedFields.push('notes');
                }
            }

            if (newTags.length > 0) {
                if (!isFieldLocked('tags')) {
                    updateFields.tags = newTags;
                    hasUpdates = true;
                } else {
                    blockedFields.push('tags');
                }
            }

            // Apply the updates to Recommendation table
            if (hasUpdates) {
                await recommendation.update(updateFields);
                await recommendation.reload();
            }

            // Build response message
            let responseMessage = '';
            if (hasUpdates) {
                responseMessage = 'Manual update complete!';
            }

            if (blockedFields.length > 0) {
                const blockedList = blockedFields.join(', ');
                if (hasUpdates) {
                    responseMessage += ` Note: ${blockedList} ${blockedFields.length === 1 ? 'was' : 'were'} not updated due to modlock restrictions.`;
                } else {
                    responseMessage = `No fields were updated. The following ${blockedFields.length === 1 ? 'field is' : 'fields are'} modlocked: ${blockedList}`;
                }
            } else if (!hasUpdates) {
                responseMessage = 'No fields were updated. Please provide at least one field to update when using manual_only mode.';
            }

            if (hasUpdates) {
                // Return updated recommendation with embed
                const recWithSeries = await fetchRecWithSeries(recommendation.id, true);
                const embed = createRecEmbed(recWithSeries);

                await interaction.editReply({
                    content: responseMessage,
                    embeds: [embed]
                });
            } else {
                await interaction.editReply({
                    content: responseMessage
                });
            }
        }

        // User metadata already saved above via saveUserMetadata
    } catch (error) {
        console.error('[rec update] Error:', error);
        await interaction.editReply({
            content: error.message || 'There was an error updating the recommendation. Please try again.'
        });
    }
}
