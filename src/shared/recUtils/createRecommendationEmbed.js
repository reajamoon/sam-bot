
import { EmbedBuilder } from 'discord.js';
import quickLinkCheck from './quickLinkCheck.js';
import isValidFanficUrl from './isValidFanficUrl.js';

// Map AO3 normalized rating names to custom emoji
const ratingEmojis = {
    'general audiences': '<:ratinggeneral:1133762158077935749>',
    'teen and up audiences': '<:ratingteen:1133762194174136390>',
    'mature': '<:ratingmature:1133762226738700390>',
    'explicit': '<:ratingexplicit:1133762272087506965>'
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

// Map fic ratings to embed colors
const ratingColors = {
    'general audiences': 0x43a047,      // Green
    'teen and up audiences': 0xffeb3b, // Yellow
    'mature': 0xff9800,                // Orange
    'explicit': 0xd32f2f,              // Red
    'not rated': 0x757575,             // Grey
    'unrated': 0x757575
};

// Helper to determine if a rec is a series
function isSeriesRec(rec) {
    if (!rec || typeof rec !== 'object') return false;
    if (rec.type === 'series') return true;
    if (typeof rec.url === 'string' && rec.url.includes('/series/')) return true;
    if (Array.isArray(rec.series_works) && rec.series_works.length > 0 && !rec.notPrimaryWork) return true;
    return false;
}

// Helper: get effective rating and color for a rec
function getRatingAndColor(rating) {
    let color = 0x333333; // Default (Dark Grey)
    let ratingValue = rating;
    if (typeof rating === 'string') {
        const key = rating.trim().toLowerCase();
        if (ratingColors[key]) {
            color = ratingColors[key];
        }
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
    if (Array.isArray(rec.series_works)) {
        for (const work of rec.series_works) {
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

// Helper: Add tags field (dedupes, normalizes, concatenates)
function addTagsField(embed, rec) {
    const freeformTags = Array.isArray(rec.tags) ? rec.tags : [];
    const additionalTags = Array.isArray(rec.additionalTags) ? rec.additionalTags : [];
    const normalizedTagMap = new Map();
    for (const tag of [...freeformTags, ...additionalTags]) {
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

// Helper: Add notes field
function addNotesField(embed, rec) {
    if (rec.notes) {
        embed.addFields({ name: 'Recommender Notes', value: `>>> ${rec.notes}` });
    }
}

// Helper: Add engagement fields (Hits, Kudos, Bookmarks)
function addEngagementFields(embed, rec) {
    const engagementFields = [];
    if (rec.hits) engagementFields.push({ name: 'Hits', value: rec.hits.toLocaleString(), inline: true });
    if (rec.kudos) engagementFields.push({ name: 'Kudos', value: rec.kudos.toLocaleString(), inline: true });
    if (rec.bookmarks) engagementFields.push({ name: 'Bookmarks', value: rec.bookmarks.toLocaleString(), inline: true });
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
    const { EmbedBuilder } = require('discord.js');
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

// Builds the embed for a rec. Checks if the link works, adds warnings if needed.
async function createRecommendationEmbed(rec) {
    // If this work is part of a series, show series info
    if (rec.series && typeof rec.series === 'object' && rec.series.name && rec.series.url && rec.series.part) {
        embed.addFields({
            name: 'Series',
            value: `[Part ${rec.series.part} of ${rec.series.name}](${rec.series.url})`
        });
    }
    if (isSeriesRec(rec)) {
        return await createSeriesRecommendationEmbed(rec);
    }
    // Series embed builder
    async function createSeriesRecommendationEmbed(rec) {
        // Determine effective rating for the series (highest among works, or series rating)
        let effectiveRating = rec.rating;
        if ((!effectiveRating || effectiveRating.toLowerCase() === 'unrated' || effectiveRating.toLowerCase() === 'not rated') && Array.isArray(rec.series_works)) {
            // Find highest rating among works
            const ratingOrder = ['not rated', 'unrated', 'general audiences', 'teen and up audiences', 'mature', 'explicit'];
            let maxIdx = 0;
            for (const work of rec.series_works) {
                if (work.rating && typeof work.rating === 'string') {
                    const idx = ratingOrder.indexOf(work.rating.trim().toLowerCase());
                    if (idx > maxIdx) maxIdx = idx;
                }
            }
            effectiveRating = ratingOrder[maxIdx] || 'Unrated';
        }
        const { ratingValue, color } = getRatingAndColor(effectiveRating);

        const embed = new EmbedBuilder()
            .setTitle(`📚 ${rec.title}`)
            .setDescription(`**Series by:** ${(rec.authors && Array.isArray(rec.authors)) ? rec.authors.join(', ') : (rec.author || 'Unknown Author')}`)
            .setURL(rec.url)
            .setColor(color)
            .setTimestamp()
            .setFooter({
                text: `From the Profound Bond Library • Recommended by ${rec.recommendedByUsername} • ID: ${rec.id}`
            });
        if (rec.summary) {
            const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
            embed.addFields({
                name: 'Series Summary',
                value: `>>> ${summaryText}`
            });
        }
        const isLinkWorking = rec.deleted ? false : await quickLinkCheck(rec.url);
        const siteInfo = isValidFanficUrl(rec.url);
        const linkText = buildStoryLinkText(rec, isLinkWorking, siteInfo);
        const linkAndMetaFields = [
            {
                name: '🔗 Series Link',
                value: linkText,
                inline: true
            }
        ];
        if (effectiveRating) {
            linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
        }
        addStatusField(linkAndMetaFields, rec);
        embed.addFields(linkAndMetaFields);
        addStatsFields(embed, rec);
        addSeriesWarningsField(embed, rec);
        addTagsField(embed, rec);
        addNotesField(embed, rec);
        addEngagementFields(embed, rec);
        if (Array.isArray(rec.series_works) && rec.series_works.length > 0) {
            const maxToShow = 5;
            let worksList = '';
            for (let i = 0; i < Math.min(rec.series_works.length, maxToShow); i++) {
                const work = rec.series_works[i];
                const title = work.title || `Work #${i + 1}`;
                const url = work.url || rec.url;
                worksList += `${i + 1}. [${title}](${url})\n`;
            }
            if (rec.series_works.length > maxToShow) {
                worksList += `${maxToShow}. [and more...](${rec.url})`;
            }
            embed.addFields({
                name: `Works in Series (${rec.series_works.length})`,
                value: worksList.trim()
            });
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

export {
    isSeriesRec,
    buildBaseEmbed,
    buildStoryLinkText,
    getRatingAndColor,
    addWorkWarningsField,
    addSeriesWarningsField,
    addTagsField,
    addNotesField,
    addEngagementFields,
    addStatsFields,
    addStatusField
};