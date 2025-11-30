import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { saveUserMetadata, detectSiteAndExtractIDs } from '../../../../shared/recUtils/processUserMetadata.js';
import { Series } from '../../../../models/index.js';
import createOrJoinQueueEntry from '../../../../shared/recUtils/createOrJoinQueueEntry.js';
import normalizeAO3Url from '../../../../shared/recUtils/normalizeAO3Url.js';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import { isFieldGloballyModlockedFor } from '../../../../shared/modlockUtils.js';
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
        let newRating = interaction.options.getString('rating');
        if (newRating) {
            newRating = normalizeRating(newRating);
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

        // If manual_only is true, handle as direct UserFicMetadata update only
        if (manualOnly) {
            return await handleManualOnlyUpdate(interaction, series, {
                newTitle,
                newAuthor,
                newSummary,
                newAdditionalTags,
                newRating,
                newNotes,
                newStatus,
                deleted
            });
        }

        // Otherwise handle as queue update with manual overrides stored in UserFicMetadata
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

    // Save user metadata - this is the ONLY action for manual_only
    const metadataPayload = {
        userId: interaction.user.id,
        seriesId: series.ao3SeriesId || null, // Use AO3 series ID for UserFicMetadata
        ficType: 'series',
        action: 'manual_only_update'
    };

    // Add manual overrides that were provided
    const updates_made = [];
    if (newTitle !== null) {
        metadataPayload.manual_title = newTitle;
        updates_made.push('title');
    }
    if (newAuthor !== null) {
        metadataPayload.manual_authors = Array.isArray(newAuthor) ? newAuthor : [newAuthor];
        updates_made.push('author');
    }
    if (newSummary !== null) {
        metadataPayload.manual_summary = newSummary;
        updates_made.push('summary');
    }
    if (newAdditionalTags && newAdditionalTags.length > 0) {
        metadataPayload.additional_tags = newAdditionalTags;
        updates_made.push('additional tags');
    }
    if (newRating !== null) {
        metadataPayload.manual_rating = newRating;
        updates_made.push('rating');
    }
    if (newNotes !== null) {
        metadataPayload.rec_note = newNotes;
        updates_made.push('notes');
    }
    if (newStatus !== null) {
        metadataPayload.manual_status = newStatus;
        updates_made.push('status');
    }

    await saveUserMetadata(metadataPayload);

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

    const responseMessage = `🔄 Series "${series.name}" has been queued for update. You'll be notified when processing is complete.`;
    await interaction.editReply({
        content: responseMessage
    });
}