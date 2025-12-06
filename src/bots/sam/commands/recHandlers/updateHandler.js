import findRecommendationByIdOrUrl from '../../../../shared/recUtils/findRecommendationByIdOrUrl.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import isValidFanficUrl from '../../../../shared/recUtils/isValidFanficUrl.js';
import { saveUserMetadata, detectSiteAndExtractIDs } from '../../../../shared/recUtils/processUserMetadata.js';
import { Recommendation, ParseQueueSubscriber, Config } from '../../../../models/index.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import { createRecEmbed } from '../../../../shared/recUtils/createRecEmbed.js';
import { fetchRecWithSeries } from '../../../../models/index.js';
import { markPrimaryAndNotPrimaryWorks } from './seriesUtils.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { setModLock } from '../../../../shared/utils/modLockUtils.js';
import { isFieldGloballyModlockedFor } from '../../../../shared/utils/globalModlockUtils.js';
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
    
    // Channel policy: in fic_rec_channel, require a note (keep embeds clean in rec channel)
    try {
        const recChannelCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
        const recChannelId = recChannelCfg && recChannelCfg.value ? recChannelCfg.value : null;
        if (recChannelId && interaction.channelId === recChannelId) {
            const newNotes = interaction.options.getString('notes');
            // Enforce minimum length using config fallback 50
            let minLen = 50;
            try {
                const minCfg = await Config.findOne({ where: { key: 'min_rec_note_length' } });
                if (minCfg && Number(minCfg.value) > 0) minLen = Number(minCfg.value);
            } catch {}
            if (!newNotes || !newNotes.trim() || newNotes.trim().length < minLen) {
                const line = `Every rec in here needs a recommender’s note. Make sure it's at least ${minLen} characters.

Tell us what you love: squee, gush, nerd out. Share the good stuff readers look for. If you’re bumping a WIP for a chapter update, drop a new line or add a little more detail to your note. And if you’ve already left one, you can nudge a friend to add theirs.

For raw refreshes without a note, hop over to the team-free-bots channel.`;
                return await interaction.editReply({ content: line, flags: MessageFlags.Ephemeral });
            }
        }
    } catch (policyErr) {
        // Non-fatal; continue with update flow
        console.warn('[rec update] Note policy check failed:', policyErr);
    }
    
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
        // Only normalize rating if provided; otherwise keep null
        let newRating = interaction.options.getString('rating');
        if (newRating && newRating.trim()) {
            newRating = normalizeRating(newRating);
        } else {
            newRating = null;
        }
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
        if (newRating !== null) manualFields.rating = newRating;
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

            // In fic_rec_channel with a note, mirror add-handler immediate embed behavior for recent entries
            try {
                const recChannelCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                const recChannelId = recChannelCfg && recChannelCfg.value ? recChannelCfg.value : null;
                const inRecChannel = recChannelId && interaction.channelId === recChannelId;
                if (inRecChannel && newNotes && newNotes.trim()) {
                    // If recommendation exists and is fresh (<= 1 day), post embed now and confirm ephemerally
                    const oneDayMs = 24 * 60 * 60 * 1000;
                    const lastUpdated = recommendation.updatedAt || recommendation.createdAt;
                    const ageMs = Date.now() - new Date(lastUpdated).getTime();
                    if (ageMs <= oneDayMs) {
                        const recWithSeries = await fetchRecWithSeries(recommendation.id, true);
                        const embed = createRecEmbed(recWithSeries, { preferredUserId: interaction.user.id, overrideNotes: newNotes });
                        try {
                            const recCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                            const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
                            let targetChannel = null;
                            const channelIdPref = recCfg && recCfg.value ? recCfg.value : (queueCfg && queueCfg.value ? queueCfg.value : null);
                            if (channelIdPref) {
                                targetChannel = interaction.client.channels.cache.get(channelIdPref) || await interaction.client.channels.fetch(channelIdPref).catch(() => null);
                            }
                            if (!targetChannel) targetChannel = interaction.channel;
                            if (targetChannel) {
                                await targetChannel.send({ embeds: [embed] });
                            }
                        } catch (postErr) {
                            console.warn('[rec update] Failed to post public embed (immediate fic-recs):', postErr);
                        }
                        try { await interaction.deleteReply(); } catch {}
                        await interaction.followUp({ content: 'Filed it in the library.', flags: MessageFlags.Ephemeral });
                        return;
                    }
                }
            } catch (e) {
                console.warn('[rec update] Fic-recs immediate embed path failed, falling back to queue:', e);
            }

            // Persist allowed manual fields to Recommendation immediately so embeds reflect changes
            try {
                const immediateUpdateFields = {};
                const blockedFieldsImmediate = [];
                const lockedFieldsToSet = [];
                const considerField = (name, value) => {
                    if (value !== null && value !== undefined) {
                        if (!isFieldLocked(name)) {
                            immediateUpdateFields[name] = value;
                            // Lock fields that are corrections, excluding notes/additional tags
                            if (!['notes', 'additionalTags', 'tags'].includes(name)) {
                                lockedFieldsToSet.push(name);
                            }
                        } else {
                            blockedFieldsImmediate.push(name);
                        }
                    }
                };
                considerField('title', newTitle);
                considerField('author', newAuthor);
                considerField('summary', newSummary);
                considerField('rating', newRating);
                considerField('wordCount', newWordCount);
                considerField('status', newStatus);
                if (deleted !== null) considerField('deleted', deleted);
                if (newAttachment) considerField('attachmentUrl', newAttachment.url);
                if (newTags.length > 0) considerField('tags', newTags);
                if (Object.keys(immediateUpdateFields).length > 0) {
                    await recommendation.update(immediateUpdateFields);
                    await recommendation.reload();
                    // Create ModLock entries for lockedFieldsToSet
                    try {
                        const { ModLock, Series, User } = await import('../../../../models/index.js');
                        let level = 'member';
                        const userRecord = await User.findOne({ where: { discordId: interaction.user.id } });
                        if (userRecord && userRecord.permissionLevel) {
                            level = userRecord.permissionLevel.toLowerCase();
                        }
                        for (const fieldName of lockedFieldsToSet) {
                            const payload = {
                                field: fieldName,
                                locked: true,
                                lockLevel: level,
                                lockedBy: interaction.user.id,
                                lockedAt: new Date(),
                            };
                            if (recommendation.ao3ID) payload.ao3ID = recommendation.ao3ID;
                            if (!payload.ao3ID && recommendation.seriesId) {
                                const series = await Series.findByPk(recommendation.seriesId);
                                if (series && series.ao3SeriesId) payload.seriesId = series.ao3SeriesId;
                            }
                            await ModLock.create(payload);
                        }
                    } catch (lockErr) {
                        console.error('[Rec update] Failed to create modlocks for immediate fields:', lockErr);
                    }
                }
            } catch (e) {
                console.error('[Rec update] Immediate persistence of manual fields failed (non-manual mode):', e);
            }

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
                    // In fic_rec_channel, post a clean embed now and record it for later edit
                    try {
                        const recChannelCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                        const inRecChannel = recChannelCfg && recChannelCfg.value && interaction.channelId === recChannelCfg.value;
                        if (inRecChannel) {
                            const recWithSeries = await fetchRecWithSeries(recommendation.id, true);
                            const embedNow = createRecEmbed(recWithSeries, { preferredUserId: interaction.user.id, overrideNotes: newNotes });
                            const recCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                            const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
                            let targetChannel = null;
                            const channelIdPref = recCfg && recCfg.value ? recCfg.value : (queueCfg && queueCfg.value ? queueCfg.value : null);
                            if (channelIdPref) {
                                targetChannel = interaction.client.channels.cache.get(channelIdPref) || await interaction.client.channels.fetch(channelIdPref).catch(() => null);
                            }
                            if (!targetChannel) targetChannel = interaction.channel;
                            const postedMsg = await targetChannel.send({ embeds: [embedNow] });
                            await ParseQueueSubscriber.update(
                                { channel_id: postedMsg.channelId, message_id: postedMsg.id },
                                { where: { queue_id: queueEntry.id, user_id: interaction.user.id } }
                            );
                            try { await interaction.deleteReply(); } catch {}
                            await interaction.followUp({ content: 'Filed it in the library.', flags: MessageFlags.Ephemeral });
                            return;
                        } else {
                            await interaction.editReply({ content: "Refreshing that fic’s metadata. I’ll post the updated embed when it’s ready." });
                            const msg = await interaction.fetchReply();
                            await ParseQueueSubscriber.update(
                                { channel_id: msg.channelId, message_id: msg.id },
                                { where: { queue_id: queueEntry.id, user_id: interaction.user.id } }
                            );
                        }
                    } catch (e) {
                        console.warn('[rec update] Failed to record message tracking for existing processing:', e);
                    }
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
                // Handle existing queue entry for this URL (unique constraint)
                if ((err && err.code === '23505') || (err && err.name === 'SequelizeUniqueConstraintError')) {
                    queueEntry = await ParseQueue.findOne({ where: { fic_url: urlToUse } });
                    if (!queueEntry) throw err; // Shouldn't happen, but bubble up if it does

                    // If already pending/processing, just subscribe and inform the user
                    if (queueEntry.status === 'pending' || queueEntry.status === 'processing') {
                        await interaction.editReply({
                            content: "Refreshing that fic’s metadata. I’ll post the updated embed when it’s ready."
                        });
                        try {
                            const msg = await interaction.fetchReply();
                            await ParseQueueSubscriber.update(
                                { channel_id: msg.channelId, message_id: msg.id },
                                { where: { queue_id: queueEntry.id, user_id: interaction.user.id } }
                            );
                        } catch (e) {
                            console.warn('[rec update] Failed to record message tracking during requeue existing processing:', e);
                        }
                        return;
                    }

                    // Otherwise, requeue the existing entry (handles 'error', 'nOTP', 'done', etc.)
                    try {
                        // Decide instant candidate again on requeue
                        const activeJobsRecheck = await ParseQueue.count({ where: { status: ['pending', 'processing'] } });
                        const instantRequeue = !isSeriesUrl && activeJobsRecheck === 0;

                        // Preserve or update requested_by (append if different)
                        let requestedBy = interaction.user.id;
                        if (queueEntry.requested_by && !queueEntry.requested_by.split(',').includes(interaction.user.id)) {
                            requestedBy = `${queueEntry.requested_by},${interaction.user.id}`;
                        }

                        await queueEntry.update({
                            status: 'pending',
                            validation_reason: null,
                            error_message: null,
                            result: null,
                            submitted_at: new Date(),
                            requested_by: requestedBy,
                            instant_candidate: instantRequeue,
                            batch_type: isSeriesUrl ? 'series' : null
                        });
                    } catch (updErr) {
                        console.error('[Rec update] Failed to requeue existing ParseQueue entry:', updErr);
                        throw err; // fall back to original error handling
                    }
                } else {
                    throw err;
                }
            }

            let existingSub = await ParseQueueSubscriber.findOne({ where: { queue_id: queueEntry.id, user_id: interaction.user.id } });
            if (!existingSub) {
                try {
                    existingSub = await ParseQueueSubscriber.create({ queue_id: queueEntry.id, user_id: interaction.user.id });
                } catch (err) {
                    console.error('[RecHandler] Error adding ParseQueueSubscriber:', err, { queue_id: queueEntry.id, user_id: interaction.user.id });
                }
            }

            // In fic_rec_channel, post a clean embed now and record it for poller edit
            try {
                const recChannelCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                const inRecChannel = recChannelCfg && recChannelCfg.value && interaction.channelId === recChannelCfg.value;
                if (inRecChannel) {
                    const recWithSeries = await fetchRecWithSeries(recommendation.id, true);
                    const embedNow = createRecEmbed(recWithSeries, { preferredUserId: interaction.user.id, overrideNotes: newNotes });
                    // Avoid duplicate embeds if we already have a tracked message for this queue/user
                    if (!existingSub || !existingSub.channel_id || !existingSub.message_id) {
                        const recCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                        const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
                        let targetChannel = null;
                        const channelIdPref = recCfg && recCfg.value ? recCfg.value : (queueCfg && queueCfg.value ? queueCfg.value : null);
                        if (channelIdPref) {
                            targetChannel = interaction.client.channels.cache.get(channelIdPref) || await interaction.client.channels.fetch(channelIdPref).catch(() => null);
                        }
                        if (!targetChannel) targetChannel = interaction.channel;
                        const postedMsg = await targetChannel.send({ embeds: [embedNow] });
                        await ParseQueueSubscriber.update(
                            { channel_id: postedMsg.channelId, message_id: postedMsg.id },
                            { where: { queue_id: queueEntry.id, user_id: interaction.user.id } }
                        );
                        try { await interaction.deleteReply(); } catch {}
                        await interaction.followUp({ content: 'Filed it in the library.', flags: MessageFlags.Ephemeral });
                    } else {
                        // We already have a tracked message; keep the reply minimal and let the poller edit
                        await interaction.editReply({ content: "Refreshing that fic’s metadata. I’ll update the existing embed when it’s ready." });
                    }
                } else {
                    await interaction.editReply({ content: "Refreshing that fic’s metadata. I’ll post the updated embed when it’s ready." });
                    const msg = await interaction.fetchReply();
                    await ParseQueueSubscriber.update(
                        { channel_id: msg.channelId, message_id: msg.id },
                        { where: { queue_id: queueEntry.id, user_id: interaction.user.id } }
                    );
                }
            } catch (e) {
                console.warn('[rec update] Failed to record message tracking on new queue:', e);
            }
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
                const embed = createRecEmbed(recWithSeries, {
                    // Tie footer to owner if a new note was supplied
                    preferredUserId: newNotes ? interaction.user.id : undefined
                });
                // Post publicly and ephemeral-confirm
                try {
                    const recCfg = await Config.findOne({ where: { key: 'fic_rec_channel' } });
                    const queueCfg = await Config.findOne({ where: { key: 'fic_queue_channel' } });
                    let targetChannel = null;
                    const channelIdPref = recCfg && recCfg.value ? recCfg.value : (queueCfg && queueCfg.value ? queueCfg.value : null);
                    if (channelIdPref) {
                        targetChannel = interaction.client.channels.cache.get(channelIdPref) || await interaction.client.channels.fetch(channelIdPref).catch(() => null);
                    }
                    if (!targetChannel) targetChannel = interaction.channel;
                    if (targetChannel) {
                        await targetChannel.send({ embeds: [embed] });
                    }
                } catch (postErr) {
                    console.warn('[rec update] Failed to post public embed (manual-only):', postErr);
                }
                try { await interaction.deleteReply(); } catch {}
                await interaction.followUp({ content: responseMessage, flags: MessageFlags.Ephemeral });
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
