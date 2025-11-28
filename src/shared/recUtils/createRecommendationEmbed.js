
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import quickLinkCheck from './quickLinkCheck.js';
import isValidFanficUrl from './isValidFanficUrl.js';
import { getAo3RatingColor } from './ao3/ao3TagColors.js';

// Map AO3 normalized rating names to custom emoji
const ratingEmojis = {
    'general audiences': '<:ratinggeneral:1133762158077935749>',
    'teen and up audiences': '<:ratingteen:1133762194174136390>',
    'mature': '<:ratingmature:1133762226738700390>',
    'explicit': '<:ratingexplicit:1133762272087506965>',
    'not rated': '❔',
    'unrated': '❔'
};

// Archive warning emoji and logic
const majorWarningEmoji = '<:warn_yes:1142772202379415622>';
const maybeWarningEmoji = '<:warn_maybe:1142772269156933733>';
const majorWarningsList = [
    'Graphic Depictions of Violence',
    'Major Character Death',
    'Rape/Non-Con',
    'Underage',
    'Underage Sex'
];


// Helper to determine if a rec is a series
function isSeriesRec(rec) {
    if (!rec || typeof rec !== 'object') return false;
    if (rec.type === 'series') return true;
    if (typeof rec.url === 'string' && rec.url.includes('/series/')) return true;
    if (rec.series && Array.isArray(rec.series.series_works) && rec.series.series_works.length > 0 && !rec.notPrimaryWork) return true;
    return false;
}

// Helper: get effective rating and color for a rec
function getRatingAndColor(rating) {
    let color = getAo3RatingColor('not rated'); // Default (AO3 not rated gray)
    let ratingValue = rating;
    if (typeof rating === 'string') {
        const key = rating.trim().toLowerCase();
        color = getAo3RatingColor(key);
        if (ratingEmojis[key]) {
            ratingValue = `${ratingEmojis[key]} ${rating}`;
        }
    }
    return { ratingValue, color };
}

// Helper to build the story link text, handling deleted/attachment/link/site
function buildStoryLinkText(rec, isLinkWorking, siteInfo) {
    let siteName = 'Here';
    if (siteInfo && siteInfo.site) {
        switch (siteInfo.site) {
                case 'ao3': siteName = 'on Ao3'; break;
                case 'ffn': siteName = 'on FF.net'; break;
                case 'wattpad': siteName = 'on Wattpad'; break;
                case 'tumblr': siteName = 'on Tumblr'; break;
                case 'dreamwidth': siteName = 'on Dreamwidth'; break;
                case 'livejournal': siteName = 'on Livejournal'; break;
                default: siteName = 'Here';
            }
        }
        let linkText = `[Read ${siteName}](${rec.url})`;
        if (rec.deleted) {
            linkText += ' 🗑 *Story deleted*';
            if (rec.attachmentUrl) {
                linkText += `\n📎 [Backup Available](${rec.attachmentUrl})`;
            }
        } else if (!isLinkWorking) {
            linkText += ' ⚠';
        }
    return linkText;
}

// Helper: Add warnings field for a single work
function addWorkWarningsField(embed, rec) {
    let warnings = typeof rec.getArchiveWarnings === 'function' ? rec.getArchiveWarnings() : [];
    warnings = warnings.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean);
    warnings = [...new Set(warnings)];
    const filtered = warnings.filter(w => w.toLowerCase() !== 'no archive warnings apply');
    if (filtered.length > 0) {
        let fieldValue = '';
        if (
            filtered.length === 1 &&
            filtered[0].toLowerCase() === 'creator chose not to use archive warnings'
        ) {
            fieldValue = `${maybeWarningEmoji} Creator Chose Not To Use Archive Warnings`;
        } else {
            const hasMajor = filtered.some(w =>
                majorWarningsList.some(mw => w.toLowerCase().includes(mw.toLowerCase()))
            );
            if (hasMajor) {
                fieldValue = `${majorWarningEmoji} ${filtered.join(', ')}`;
            } else {
                fieldValue = filtered.join(', ');
            }
        }
        embed.addFields({
            name: 'Major Content Warnings',
            value: fieldValue
        });
    }
}

// Helper: Add warnings field for a series (aggregate from all child works)
function addSeriesWarningsField(embed, rec) {
    let allWarnings = [];
    if (rec.series && Array.isArray(rec.series.series_works)) {
        for (const work of rec.series.series_works) {
            let warnings = typeof work.getArchiveWarnings === 'function' ? work.getArchiveWarnings() : [];
            warnings = warnings.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean);
            allWarnings.push(...warnings);
        }
    }
    allWarnings = allWarnings.map(w => w.toLowerCase());
    const normalized = Array.from(new Set(allWarnings)).filter(w => w && w !== 'no archive warnings apply');
    if (normalized.length > 0) {
        let fieldValue = '';
        if (
            normalized.length === 1 &&
            normalized[0] === 'creator chose not to use archive warnings'
        ) {
            fieldValue = `${maybeWarningEmoji} Creator Chose Not To Use Archive Warnings`;
        } else {
            const hasMajor = normalized.some(w =>
                majorWarningsList.some(mw => w.includes(mw.toLowerCase()))
            );
            if (hasMajor) {
                fieldValue = `${majorWarningEmoji} ${normalized.join(', ')}`;
            } else {
                fieldValue = normalized.join(', ');
            }
        }
        embed.addFields({
            name: 'Major Content Warnings',
            value: fieldValue
        });
    }
}

// Helper: Add tags field (dedupes, normalizes, concatenates all tag sources)
function addTagsField(embed, rec) {
    const freeformTags = Array.isArray(rec.tags) ? rec.tags : [];

    // Get additional tags from all UserFicMetadata entries
    const userAdditionalTags = [];
    if (rec.userMetadata && Array.isArray(rec.userMetadata)) {
        for (const userMeta of rec.userMetadata) {
            if (userMeta.additional_tags && Array.isArray(userMeta.additional_tags)) {
                userAdditionalTags.push(...userMeta.additional_tags);
            }
        }
    }
    // Normalize and deduplicate all tag sources
    const normalizedTagMap = new Map();
    for (const tag of [...freeformTags, ...userAdditionalTags]) {
        if (typeof tag === 'string') {
            const norm = tag.trim().toLowerCase();
            if (norm && !normalizedTagMap.has(norm)) {
                normalizedTagMap.set(norm, tag.trim());
            }
        }
    }
    const allTags = Array.from(normalizedTagMap.values());
    if (allTags.length > 0) {
        let tagString = '';
        let i = 0;
        while (i < allTags.length) {
            const next = tagString.length === 0 ? allTags[i] : ', ' + allTags[i];
            if ((tagString + next).length > 1021) { // 1021 to allow for '...'
                tagString += '...';
                break;
            }
            tagString += next;
            i++;
        }
        embed.addFields({
            name: 'Tags',
            value: tagString
        });
    }
}

// Helper: Add series field for works that belong to a series
function addSeriesField(embed, rec) {
    if (rec.series && rec.part && rec.series.name && rec.series.url) {
        embed.addFields({
            name: '',
            value: `[Part ${rec.part} of ${rec.series.name}](${rec.series.url})`,
            inline: false
        });
    }
}

// Helper: Get a random user note if any exist
function getRandomUserNote(rec) {
    if (!rec.userMetadata || !Array.isArray(rec.userMetadata) || rec.userMetadata.length === 0) {
        return null;
    }

    // Filter for notes that exist and aren't empty
    const notesWithText = rec.userMetadata.filter(metadata =>
        metadata.rec_note && typeof metadata.rec_note === 'string' && metadata.rec_note.trim().length > 0
    );

    if (notesWithText.length === 0) {
        return null;
    }
    // Randomly select one note
    const randomIndex = Math.floor(Math.random() * notesWithText.length);
    return notesWithText[randomIndex].rec_note.trim();
}

// Helper: Add notes field (both original notes and user notes)
function addNotesField(embed, rec) {
    const userNote = getRandomUserNote(rec);
    // Original recommender notes (deprecated but may still exist)
    if (rec.notes) {
        embed.addFields({ name: 'Recommender Notes', value: `>>> ${rec.notes}` });
    }
    // User notes from UserFicMetadata
    if (userNote) {
        embed.addFields({ name: '📝 Reader Note', value: `>>> ${userNote}` });
    }
}

// Helper: Add engagement fields (Hits, Kudos, Bookmarks)
function addEngagementFields(embed, rec) {
    const engagementFields = [];
    // Handle hits - check for valid number greater than 0
    if (rec.hits != null && typeof rec.hits === 'number' && rec.hits > 0) {
        engagementFields.push({ name: 'Hits', value: rec.hits.toLocaleString(), inline: true });
    }
    // Handle kudos - check for valid number greater than 0
    if (rec.kudos != null && typeof rec.kudos === 'number' && rec.kudos > 0) {
        engagementFields.push({ name: 'Kudos', value: rec.kudos.toLocaleString(), inline: true });
    }
    // Handle bookmarks - check for valid number greater than 0
    if (rec.bookmarks != null && typeof rec.bookmarks === 'number' && rec.bookmarks > 0) {
        engagementFields.push({ name: 'Bookmarks', value: rec.bookmarks.toLocaleString(), inline: true });
    }
    if (engagementFields.length > 0) {
        embed.addFields(engagementFields);
    }
}

// Helper: Add stats fields (published/updated, chapters, words)
function addStatsFields(embed, rec) {
    const statsFields = [];
    // Determine which date to show and its label
    let dateLabel = null;
    let dateValue = null;
    if (rec.publishedDate && rec.updatedDate) {
        // Compare as ISO strings if possible, fallback to string compare
        const pub = new Date(rec.publishedDate);
        const upd = new Date(rec.updatedDate);
        if (!isNaN(pub) && !isNaN(upd)) {
            if (upd > pub) {
                dateLabel = 'Updated';
                dateValue = rec.updatedDate;
            } else {
                dateLabel = 'Published';
                dateValue = rec.publishedDate;
            }
            } else {
                // Fallback: just show updated if present
                dateLabel = 'Updated';
                dateValue = rec.updatedDate;
            }
            } else if (rec.updatedDate) {
                dateLabel = 'Updated';
                dateValue = rec.updatedDate;
            } else if (rec.publishedDate) {
                dateLabel = 'Published';
                dateValue = rec.publishedDate;
            }
            if (dateLabel && dateValue) {
                statsFields.push({ name: dateLabel, value: dateValue, inline: true });
            }
            if (rec.chapters) statsFields.push({ name: 'Chapters', value: rec.chapters, inline: true });
            if (rec.wordCount) statsFields.push({ name: 'Words', value: rec.wordCount.toLocaleString(), inline: true });
            if (statsFields.length > 0) {
                embed.addFields(statsFields);
            }
}

// Helper: Add status field (handles deleted, missing, etc)
function addStatusField(fields, rec) {
    if (rec.status) {
        let statusValue = rec.status;
        if (rec.deleted) statusValue += ' (Deleted)';
        fields.push({ name: 'Status', value: statusValue, inline: true });
    } else if (rec.deleted) {
        fields.push({ name: 'Status', value: 'Deleted', inline: true });
    }
}

// Build the base embed structure shared by both work and series recs
function buildBaseEmbed(rec, color) {
    return new EmbedBuilder()
        .setTitle(`📖 ${rec.title}`)
        .setDescription(`**By:** ${(rec.authors && Array.isArray(rec.authors)) ? rec.authors.join(', ') : (rec.author || 'Unknown Author')}`)
        .setURL(rec.url)
        .setColor(color)
        .setTimestamp()
        .setFooter({
            text: `From the Profound Bond Library • Recommended by ${rec.recommendedByUsername} • ID: ${rec.id}`
        });
}

// Builds the embed for a rec or a series. If a Series object is provided, uses its metadata and workIds for the embed.
// Usage: createRecommendationEmbed(rec) for single rec, or createRecommendationEmbed(null, series, seriesWorks) for series
async function createRecommendationEmbed(rec, series = null, seriesWorks = null) {
    if (series) {
        // Series embed mode
        // Use series metadata for title, authors, summary, url, status, workCount, wordCount
        // Use seriesWorks (from AO3 parse or DB) for first five works field
        const { ratingValue, color } = getRatingAndColor(series.rating || 'Unrated');
        const embed = new EmbedBuilder()
            .setTitle(`📚 ${series.name || series.title || 'Untitled Series'}`)
            .setDescription(`**Series by:** ${(series.authors && Array.isArray(series.authors)) ? series.authors.join(', ') : 'Unknown Author'}`)
            .setURL(series.url)
            .setColor(color)
            .setTimestamp()
            .setFooter({
                text: `From the Profound Bond Library • Series ID: ${series.id}`
            });
        // Summary: prefer series.summary, fallback to first available work summary
        let summary = series.summary;
        if ((!summary || !summary.trim()) && Array.isArray(seriesWorks) && seriesWorks.length > 0) {
            summary = seriesWorks[0].summary;
        }
        if (summary) {
            const summaryText = summary.length > 400 ? summary.substring(0, 400) + '...' : summary;
            embed.addFields({
                name: 'Series Summary',
                value: `>>> ${summaryText}`
            });
        }
        // Series link, rating, status
        const isLinkWorking = false; // Don't check for series
        const siteInfo = isValidFanficUrl(series.url);
        const linkText = buildStoryLinkText(series, isLinkWorking, siteInfo);
        const linkAndMetaFields = [
            {
                name: '🔗 Series Link',
                value: linkText,
                inline: true
            }
        ];
        if (series.rating) {
            linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
        }
        if (series.status) {
            linkAndMetaFields.push({ name: 'Status', value: series.status, inline: true });
        }
        embed.addFields(linkAndMetaFields);
        // Stats: published/updated, number of works, words
        const statsFields = [];
        if (series.workCount) statsFields.push({ name: 'Works', value: series.workCount.toString(), inline: true });
        if (series.wordCount) statsFields.push({ name: 'Words', value: series.wordCount.toLocaleString(), inline: true });
        embed.addFields(statsFields);
        // Warnings: aggregate from seriesWorks if available
        if (Array.isArray(seriesWorks) && seriesWorks.length > 0) {
            let allWarnings = [];
            for (const work of seriesWorks) {
                if (Array.isArray(work.archive_warnings)) allWarnings.push(...work.archive_warnings);
            }
            allWarnings = allWarnings.map(w => w && typeof w === 'string' ? w.trim().toLowerCase() : '').filter(Boolean);
            const normalized = Array.from(new Set(allWarnings)).filter(w => w && w !== 'no archive warnings apply');
            if (normalized.length > 0) {
                let fieldValue = '';
                if (normalized.length === 1 && normalized[0] === 'creator chose not to use archive warnings') {
                    fieldValue = `${maybeWarningEmoji} Creator Chose Not To Use Archive Warnings`;
                } else {
                    const hasMajor = normalized.some(w => majorWarningsList.some(mw => w.includes(mw.toLowerCase())));
                    if (hasMajor) {
                        fieldValue = `${majorWarningEmoji} ${normalized.join(', ')}`;
                    } else {
                        fieldValue = normalized.join(', ');
                    }
                }
                embed.addFields({ name: 'Major Content Warnings', value: fieldValue });
            }
        }
        // Works in Series field - show first 5 works with titles and links
        let worksToDisplay = [];
        // First try to use series.series_works (direct from AO3 parsing)
        if (series.series_works && Array.isArray(series.series_works)) {
            worksToDisplay = series.series_works.slice(0, 5);
        }
        // Fallback to seriesWorks (from database relationship) if series_works not available
        else if (Array.isArray(seriesWorks) && seriesWorks.length > 0) {
            worksToDisplay = seriesWorks.slice(0, 5);
        }
        // Last resort: use workIds if available
        else if (Array.isArray(series.workIds) && series.workIds.length > 0) {
            worksToDisplay = series.workIds.slice(0, 5).map((workId, index) => ({
                title: `Work #${index + 1}`,
                url: `https://archiveofourown.org/works/${workId}`
            }));
        }
        if (worksToDisplay.length > 0) {
            let worksList = '';
            const totalWorks = series.workCount || series.workIds?.length || seriesWorks?.length || worksToDisplay.length;
            // If more than 5 works exist, show first 4 + "and X more" message
            // If 5 or fewer works exist, show all of them
            const worksToShow = totalWorks > 5 ? 4 : Math.min(5, worksToDisplay.length);
            for (let i = 0; i < worksToShow; i++) {
                const work = worksToDisplay[i];
                const title = work.title || `Work #${i + 1}`;
                const url = work.url || (work.ao3ID ? `https://archiveofourown.org/works/${work.ao3ID}` : `https://archiveofourown.org/works/${work}`);
                worksList += `${i + 1}. [${title}](${url})\n`;
            }
            if (totalWorks > 5) {
                worksList += `... and ${totalWorks - 4} more works - [View all](${series.url})`;
            }
            embed.addFields({
                name: `Works in Series (${totalWorks})`,
                value: worksList.trim()
            });
        }
        // Tags: aggregate from seriesWorks and user additional tags
        if (Array.isArray(seriesWorks) && seriesWorks.length > 0 || (series.userMetadata && Array.isArray(series.userMetadata))) {
            const normalizedTagMap = new Map();
            // Get tags from works in the series
            if (Array.isArray(seriesWorks)) {
                for (const work of seriesWorks) {
                    // Only use freeform tags from works (not deprecated additionalTags)
                    if (Array.isArray(work.tags)) {
                        for (const tag of work.tags) {
                            if (typeof tag === 'string') {
                                const norm = tag.trim().toLowerCase();
                                if (norm && !normalizedTagMap.has(norm)) {
                                    normalizedTagMap.set(norm, tag.trim());
                                }
                            }
                        }
                    }
                }
            }
            // Get additional tags from UserFicMetadata for this series
            if (series.userMetadata && Array.isArray(series.userMetadata)) {
                for (const userMeta of series.userMetadata) {
                    if (userMeta.additional_tags && Array.isArray(userMeta.additional_tags)) {
                        for (const tag of userMeta.additional_tags) {
                            if (typeof tag === 'string') {
                                const norm = tag.trim().toLowerCase();
                                if (norm && !normalizedTagMap.has(norm)) {
                                    normalizedTagMap.set(norm, tag.trim());
                                }
                            }
                        }
                    }
                }
            }
            if (normalizedTagMap.size > 0) {
                let tagString = Array.from(normalizedTagMap.values()).join(', ');
                if (tagString.length > 1021) tagString = tagString.substring(0, 1021) + '...';
                embed.addFields({ name: 'Tags', value: tagString });
            }
        }
        // Notes: original series notes and random user note
        if (series.notes) {
            embed.addFields({ name: 'Recommender Notes', value: `>>> ${series.notes}` });
        }
        // User notes from UserFicMetadata
        const userNote = getRandomUserNote(series);
        if (userNote) {
            embed.addFields({ name: '📝 Reader Note', value: `>>> ${userNote}` });
        }
        // Engagement: aggregate from seriesWorks
        if (Array.isArray(seriesWorks) && seriesWorks.length > 0) {
            let hits = 0, kudos = 0, bookmarks = 0;
            for (const work of seriesWorks) {
                if (work.hits) hits += work.hits;
                if (work.kudos) kudos += work.kudos;
                if (work.bookmarks) bookmarks += work.bookmarks;
            }
            const engagementFields = [];
            if (hits) engagementFields.push({ name: 'Hits', value: hits.toLocaleString(), inline: true });
            if (kudos) engagementFields.push({ name: 'Kudos', value: kudos.toLocaleString(), inline: true });
            if (bookmarks) engagementFields.push({ name: 'Bookmarks', value: bookmarks.toLocaleString(), inline: true });
            if (engagementFields.length > 0) embed.addFields(engagementFields);
        }
        return embed;
    }

    // Use shared helper for rating and color
    const { ratingValue, color } = getRatingAndColor(rec.rating);
    const embed = new EmbedBuilder()
        .setTitle(`📖 ${rec.title}`)
        .setDescription(`**By:** ${(rec.authors && Array.isArray(rec.authors)) ? rec.authors.join(', ') : (rec.author || 'Unknown Author')}`)
        .setURL(rec.url)
        .setColor(color)
        .setTimestamp()
        .setFooter({
            text: `From the Profound Bond Library • Recommended by ${rec.recommendedByUsername} • ID: ${rec.id}`
        });
    if (rec.summary) {
        const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
        embed.addFields({
            name: 'Summary',
            value: `>>> ${summaryText}`
        });
    }
    addSeriesField(embed, rec);
    const isLinkWorking = rec.deleted ? false : await quickLinkCheck(rec.url);
    const siteInfo = isValidFanficUrl(rec.url);
    const linkText = buildStoryLinkText(rec, isLinkWorking, siteInfo);
    // Story Link, Rating, and Status on the same line (inline fields)
    const linkAndMetaFields = [
        {
            name: '🔗 Story Link',
            value: linkText,
            inline: true
        }
    ];
    // Rating (inline)
    if (rec.rating) {
        linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
    }
    addStatusField(linkAndMetaFields, rec);
    embed.addFields(linkAndMetaFields);
    addStatsFields(embed, rec);
    addWorkWarningsField(embed, rec);
    addTagsField(embed, rec);
    addNotesField(embed, rec);
    addEngagementFields(embed, rec);
    return embed;
}

export default createRecommendationEmbed;
export {
    isSeriesRec,
    buildBaseEmbed,
    buildStoryLinkText,
    getRatingAndColor,
    addWorkWarningsField,
    addSeriesWarningsField,
    addSeriesField,
    addTagsField,
    addNotesField,
    addEngagementFields,
    addStatsFields,
    addStatusField
};