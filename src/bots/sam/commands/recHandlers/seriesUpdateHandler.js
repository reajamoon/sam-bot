import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { saveUserMetadata, detectSiteAndExtractIDs } from '../../../../shared/recUtils/processUserMetadata.js';
import { Series } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { isFieldGloballyModlockedFor } from '../../../../shared/utils/globalModlockUtils.js';
import { getLockedFieldsForSeries } from '../../../../shared/getLockedFieldsForSeries.js';

// Helper to deduplicate and lowercase tags
function cleanTags(tags) {
    if (!tags) return [];
    return Array.from(new Set(tags.map(t => t.toLowerCase().trim()).filter(Boolean)));
}

export default async function handleUpdateSeries(interaction, identifier) {
    try {
        let series = null;

        // Parse series identifier
        if (/^S\d+$/i.test(identifier)) {
            const seriesIdNum = parseInt(identifier.substring(1), 10);
            series = await Series.findByPk(seriesIdNum);
            if (!series) {
                return await interaction.editReply({
                    content: `Series S${seriesIdNum} not found.`
                });
            }
        } else if (/^https?:\/\/.*archiveofourown\.org\/series\/\d+/.test(identifier)) {
            const seriesMatch = identifier.match(/archiveofourown\.org\/series\/(\d+)/);
            const ao3SeriesId = parseInt(seriesMatch[1], 10);
            series = await Series.findOne({ where: { ao3SeriesId } });
            if (!series) {
                return await interaction.editReply({
                    content: `Series with AO3 ID ${ao3SeriesId} not found.`
                });
            }
        } else {
            return await interaction.editReply({
                content: 'Invalid series identifier. Use S### format or AO3 series URL.'
            });
        }

        // Extract update options
        const newTitle = interaction.options.getString('title');
        const newSummary = interaction.options.getString('summary');
        const newNotes = interaction.options.getString('notes');
        const deleted = interaction.options.getBoolean('deleted');
        const manualOnly = interaction.options.getBoolean('manual_only');

        // Additional series-specific fields that can be updated
        const newAuthor = interaction.options.getString('author');
        const newAdditionalTags = cleanTags(
            interaction.options.getString('tags')
                ? interaction.options.getString('tags').split(',')
                : []
        );
        // Only normalize rating if provided; otherwise keep null
        let newRating = interaction.options.getString('rating');
        if (newRating && newRating.trim()) {
            newRating = normalizeRating(newRating);
        } else {
            newRating = null;
        }

        // Restrict manual status setting to mods only
        const newStatus = interaction.options.getString('status');

        // Check if any manual fields were provided
        const hasManualFields = (
            newTitle !== null ||
            newSummary !== null ||
            newAuthor !== null ||
            (newAdditionalTags && newAdditionalTags.length > 0) ||
            newRating !== null ||
            newNotes !== null ||
            deleted !== null ||
            newStatus !== null
        );

        // If no manual fields were provided, do a simple queue rebuild
        if (!hasManualFields) {
            return await handleAutoQueueUpdate(interaction, series);
        }

        // If manual fields are provided, check modlocks and permissions
        if (newStatus !== null) {
            const member = interaction.member;
            const isMod = member && (member.permissions.has('ManageMessages') || member.permissions.has('Administrator'));
            if (!isMod) {
                await interaction.editReply({
                    content: 'You do not have permission to manually set series status. Only moderators can use this option.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        // Build modlock restrictions for the provided fields
        const perSeriesLockedFields = await getLockedFieldsForSeries(series, interaction.user);
        const globalLockedFields = new Set();
        if (manualOnly) {
            const allFields = ['title', 'author', 'summary', 'tags', 'rating', 'notes', 'status', 'deleted'];
            for (const field of allFields) {
                if (await isFieldGloballyModlockedFor(interaction.user, field)) {
                    globalLockedFields.add(field);
                }
            }
        }

        // Helper function to check if field is locked
        const isFieldLocked = (fieldName) => {
            return perSeriesLockedFields.has(fieldName) ||
                   perSeriesLockedFields.has('ALL') ||
                   (manualOnly && globalLockedFields.has(fieldName));
        };

        // Check for modlock violations on provided fields only
        const lockedFields = [];
        if (newTitle !== null && isFieldLocked('title')) lockedFields.push('title');
        if (newAuthor !== null && isFieldLocked('author')) lockedFields.push('author');
        if (newSummary !== null && isFieldLocked('summary')) lockedFields.push('summary');
        if (newAdditionalTags && newAdditionalTags.length > 0 && isFieldLocked('tags')) lockedFields.push('tags');
        if (newRating !== null && isFieldLocked('rating')) lockedFields.push('rating');
        if (newNotes !== null && isFieldLocked('notes')) lockedFields.push('notes');
        if (newStatus !== null && isFieldLocked('status')) lockedFields.push('status');
        if (deleted !== null && isFieldLocked('deleted')) lockedFields.push('deleted');

        if (lockedFields.length > 0) {
            await interaction.editReply({
                content: `Cannot update series: The following fields are locked: ${lockedFields.join(', ')}. Contact a moderator to unlock these fields.`
            });
            return;
        }

        // If manual_only is true, persist allowed fields directly to Series and save metadata
        if (manualOnly) {
            // Build update payload honoring locks
            const seriesUpdate = {};
            const appliedFields = [];
            if (newTitle !== null && !isFieldLocked('title')) { seriesUpdate.name = newTitle; appliedFields.push('title'); }
            if (newSummary !== null && !isFieldLocked('summary')) { seriesUpdate.summary = newSummary; appliedFields.push('summary'); }
            if (newRating !== null && !isFieldLocked('rating')) { seriesUpdate.rating = newRating; appliedFields.push('rating'); }
            if (newStatus !== null && !isFieldLocked('status')) { seriesUpdate.status = newStatus; appliedFields.push('status'); }
            // Persist changes if any
            if (Object.keys(seriesUpdate).length > 0) {
                await series.update(seriesUpdate);
                await series.reload();
                // Create ModLock entries for updated fields (exclude notes/additional tags)
                try {
                    const { ModLock, User } = await import('../../../../models/index.js');
                    let level = 'member';
                    const userRecord = await User.findOne({ where: { discordId: interaction.user.id } });
                    if (userRecord && userRecord.permissionLevel) {
                        level = userRecord.permissionLevel.toLowerCase();
                    }
                    const fieldsToLock = [];
                    if (newTitle !== null && !isFieldLocked('title')) fieldsToLock.push('title');
                    if (newSummary !== null && !isFieldLocked('summary')) fieldsToLock.push('summary');
                    if (newRating !== null && !isFieldLocked('rating')) fieldsToLock.push('rating');
                    if (newStatus !== null && !isFieldLocked('status')) fieldsToLock.push('status');
                    for (const fieldName of fieldsToLock) {
                        await ModLock.create({
                            seriesId: String(series.ao3SeriesId),
                            field: fieldName,
                            locked: true,
                            lockLevel: level,
                            lockedBy: interaction.user.id,
                            lockedAt: new Date(),
                        });
                    }
                } catch (lockErr) {
                    console.error('[Series update] Failed to create modlocks (manual_only):', lockErr);
                }
            }
            // Save metadata record for history and additional tags/notes
            await handleManualOnlyUpdate(interaction, series, {
                newTitle,
                newAuthor,
                newSummary,
                newAdditionalTags,
                newRating,
                newNotes,
                newStatus,
                deleted
            });
            return;
        }

        // Otherwise handle as queue update with manual overrides stored in UserFicMetadata
        // Additionally, persist allowed manual fields now so embeds reflect changes immediately
        const seriesUpdate = {};
        const appliedFields = [];
        if (newTitle !== null && !isFieldLocked('title')) { seriesUpdate.name = newTitle; appliedFields.push('title'); }
        if (newSummary !== null && !isFieldLocked('summary')) { seriesUpdate.summary = newSummary; appliedFields.push('summary'); }
        if (newRating !== null && !isFieldLocked('rating')) { seriesUpdate.rating = newRating; appliedFields.push('rating'); }
        if (newStatus !== null && !isFieldLocked('status')) { seriesUpdate.status = newStatus; appliedFields.push('status'); }
        if (Object.keys(seriesUpdate).length > 0) {
            await series.update(seriesUpdate);
            await series.reload();
            // Create ModLock entries for updated fields (exclude notes/additional tags)
            try {
                const { ModLock, User } = await import('../../../../models/index.js');
                let level = 'member';
                const userRecord = await User.findOne({ where: { discordId: interaction.user.id } });
                if (userRecord && userRecord.permissionLevel) {
                    level = userRecord.permissionLevel.toLowerCase();
                }
                const fieldsToLock = [];
                if (newTitle !== null && !isFieldLocked('title')) fieldsToLock.push('title');
                if (newSummary !== null && !isFieldLocked('summary')) fieldsToLock.push('summary');
                if (newRating !== null && !isFieldLocked('rating')) fieldsToLock.push('rating');
                if (newStatus !== null && !isFieldLocked('status')) fieldsToLock.push('status');
                for (const fieldName of fieldsToLock) {
                    await ModLock.create({
                        seriesId: String(series.ao3SeriesId),
                        field: fieldName,
                        locked: true,
                        lockLevel: level,
                        lockedBy: interaction.user.id,
                        lockedAt: new Date(),
                    });
                }
            } catch (lockErr) {
                console.error('[Series update] Failed to create modlocks (non-manual path):', lockErr);
            }
        }

        await handleQueueSeriesUpdate(interaction, series, {
            newTitle,
            newAuthor,
            newSummary,
            newAdditionalTags,
            newRating,
            newNotes,
            newStatus,
            deleted
        });

    } catch (error) {
        console.error('[series update] Error:', error);
        await interaction.editReply({
            content: error.message || 'There was an error updating the series. Please try again.'
        });
    }
}

// Handle auto queue update when no manual fields are provided
async function handleAutoQueueUpdate(interaction, series) {
    // For queue processing, we need an AO3 URL
    if (!series.ao3SeriesId) {
        return await interaction.editReply({
            content: 'Cannot queue series update: This series has no AO3 ID. Please provide manual fields to update.'
        });
    }

    const ao3Url = `https://archiveofourown.org/series/${series.ao3SeriesId}`;
    const normalizedUrl = normalizeAO3Url(ao3Url);

    // Detect site and extract IDs for queue processing
    const { siteId, siteType, seriesId, workId } = detectSiteAndExtractIDs(normalizedUrl);

    // Create or join queue entry for background processing (no manual overrides)
    const queueEntry = await createOrJoinQueueEntry(normalizedUrl, interaction.user.id);

    const responseMessage = `🔄 Series "${series.name}" has been queued for refresh from AO3. You'll be notified when processing is complete.`;
    await interaction.editReply({
        content: responseMessage
    });
}

// Handle manual-only updates (no queue, just UserFicMetadata)
async function handleManualOnlyUpdate(interaction, series, updates) {
    const { newTitle, newAuthor, newSummary, newAdditionalTags, newRating, newNotes, newStatus, deleted } = updates;

    // Build a URL for the series so saveUserMetadata can resolve site/type correctly
    const url = series.ao3SeriesId
        ? `https://archiveofourown.org/series/${series.ao3SeriesId}`
        : (series.url || null);

    // Prepare payload using the standard signature expected by saveUserMetadata
    const userMetadataOptions = {
        url,
        user: interaction.user,
        notes: newNotes || '',
        additionalTags: newAdditionalTags || [],
        manualFields: {}
    };

    const updates_made = [];
    if (newTitle !== null) {
        userMetadataOptions.manualFields.manual_title = newTitle;
        updates_made.push('title');
    }
    if (newAuthor !== null) {
        userMetadataOptions.manualFields.manual_authors = Array.isArray(newAuthor) ? newAuthor : [newAuthor];
        updates_made.push('author');
    }
    if (newSummary !== null) {
        userMetadataOptions.manualFields.manual_summary = newSummary;
        updates_made.push('summary');
    }
    if (newRating !== null) {
        userMetadataOptions.manualFields.manual_rating = newRating;
        updates_made.push('rating');
    }
    if (newStatus !== null) {
        userMetadataOptions.manualFields.manual_status = newStatus;
        updates_made.push('status');
    }

    // Persist user metadata overrides
    await saveUserMetadata(userMetadataOptions);

    const responseMessage = `✅ Manual overrides saved for series "${series.name}": ${updates_made.join(', ')}. These will be applied when the series is next updated.`;
    await interaction.editReply({
        content: responseMessage
    });
}

async function handleQueueSeriesUpdate(interaction, series, updates) {
    const { newTitle, newAuthor, newSummary, newAdditionalTags, newRating, newNotes, newStatus, deleted } = updates;

    // For queue processing, we need an AO3 URL
    if (!series.ao3SeriesId) {
        return await interaction.editReply({
            content: 'Cannot queue series update: This series has no AO3 ID. Use manual_only mode for non-AO3 series updates.'
        });
    }

    const ao3Url = `https://archiveofourown.org/series/${series.ao3SeriesId}`;
    const normalizedUrl = normalizeAO3Url(ao3Url);

    // Detect site and extract IDs for queue processing
    const { siteId, siteType, seriesId, workId } = detectSiteAndExtractIDs(normalizedUrl);

    // Save user metadata immediately using proper function signature
    const userMetadataOptions = {
        url: normalizedUrl,
        user: interaction.user,
        notes: newNotes || '',
        additionalTags: newAdditionalTags || [],
        manualFields: {}
    };

    // Add manual overrides that were provided (these will guide Jack's processing)
    if (newTitle !== null) userMetadataOptions.manualFields.manual_title = newTitle;
    if (newAuthor !== null) userMetadataOptions.manualFields.manual_authors = Array.isArray(newAuthor) ? newAuthor : [newAuthor];
    if (newSummary !== null) userMetadataOptions.manualFields.manual_summary = newSummary;

    if (newRating !== null) userMetadataOptions.manualFields.manual_rating = newRating;
    if (newStatus !== null) userMetadataOptions.manualFields.manual_status = newStatus;

    await saveUserMetadata(userMetadataOptions);

    // Create or join queue entry for background processing
    const queueEntry = await createOrJoinQueueEntry(normalizedUrl, interaction.user.id);
    // If notes or additional tags were provided, persist into ParseQueue with proper serialization
    if (newNotes || (newAdditionalTags && newAdditionalTags.length > 0)) {
        const additionalTagsString = Array.isArray(newAdditionalTags)
            ? newAdditionalTags.join(', ')
            : (typeof newAdditionalTags === 'string' ? newAdditionalTags : '');
        await queueEntry.update({
            notes: newNotes || '',
            additional_tags: additionalTagsString || null
        });
    }

    const responseMessage = `🔄 Series "${series.name}" has been queued for update. You'll be notified when processing is complete.`;
    await interaction.editReply({
        content: responseMessage
    });
}