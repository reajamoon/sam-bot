const { EmbedBuilder } = require('discord.js');
const quickLinkCheck = require('./quickLinkCheck');

// Map AO3 normalized rating names to custom emoji
const ratingEmojis = {
    'general audiences': '<:ratinggeneral:1133762158077935749>',
    'teen and up audiences': '<:ratingteen:1133762194174136390>',
    'mature': '<:ratingmature:1133762226738700390>',
    'explicit': '<:ratingexplicit:1133762272087506965>'
};

// Builds the embed for a rec. Checks if the link works, adds warnings if needed.
async function createRecommendationEmbed(rec) {
    // DEBUG: Log the rec object and tag fields to inspect tag presence
    console.log('[DEBUG] createRecommendationEmbed rec:', JSON.stringify(rec, null, 2));
    if (typeof rec.getParsedTags === 'function') {
        const parsedTags = rec.getParsedTags();
        console.log('[DEBUG] getParsedTags() result:', parsedTags);
    } else {
        console.log('[DEBUG] getParsedTags() not a function. tags:', rec.tags, 'additionalTags:', rec.additionalTags);
    }
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
    let color = 0x9C27B0; // Default (purple)
    if (rec.rating && typeof rec.rating === 'string') {
        const key = rec.rating.trim().toLowerCase();
        if (ratingColors[key]) {
            color = ratingColors[key];
        }
    }
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
    const siteName = rec.url.includes('archiveofourown.org') ? 'on Ao3' :
                    rec.url.includes('fanfiction.net') ? 'on FF.net' :
                    rec.url.includes('wattpad.com') ? 'on Wattpad' :
                    rec.url.includes('tumblr.com') ? 'on Tumblr' :
                    rec.url.includes('dreamwidth.org') ? 'on Dreamwidth' :
                    rec.url.includes('livejournal.com') ? 'on Livejournal' : 'Here';
    let linkText = `[Read ${siteName}](${rec.url})`;
    if (rec.deleted) {
        linkText += ' 🗑 *Story deleted*';
        if (rec.attachmentUrl) {
            linkText += `\n📎 [Backup Available](${rec.attachmentUrl})`;
        }
    } else if (!isLinkWorking) {
        linkText += ' ⚠';
    }
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
        let ratingValue = rec.rating;
        if (typeof rec.rating === 'string') {
            const key = rec.rating.trim().toLowerCase();
            if (ratingEmojis[key]) {
                ratingValue = `${ratingEmojis[key]} ${rec.rating}`;
            }
        }
        linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
    }
    // Status (inline)
    if (rec.status) {
        let statusValue = rec.status;
        if (rec.deleted) statusValue += ' (Deleted)';
        linkAndMetaFields.push({ name: 'Status', value: statusValue, inline: true });
    } else if (rec.deleted) {
        linkAndMetaFields.push({ name: 'Status', value: 'Deleted', inline: true });
    }
    embed.addFields(linkAndMetaFields);

    // --- Dynamic Published/Updated, Words, Chapters (all inline, same row) ---
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


    // Major Content Warnings (standalone, not inline with link row)
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
    // Only show freeform tags
    const freeformTags = Array.isArray(rec.tags) ? rec.tags : [];
    if (freeformTags.length > 0) {
        embed.addFields({
            name: 'Tags',
            value: freeformTags.slice(0, 8).join(', ') + (freeformTags.length > 8 ? '...' : '')
        });
    }
    if (rec.notes) {
        embed.addFields({ name: 'Recommender Notes', value: `>>> ${rec.notes}` });
    }
    // --- Row: Hits, Kudos, Bookmarks (all inline, same row) ---
    const engagementFields = [];
    if (rec.hits) engagementFields.push({ name: 'Hits', value: rec.hits.toLocaleString(), inline: true });
    if (rec.kudos) engagementFields.push({ name: 'Kudos', value: rec.kudos.toLocaleString(), inline: true });
    if (rec.bookmarks) engagementFields.push({ name: 'Bookmarks', value: rec.bookmarks.toLocaleString(), inline: true });
    if (engagementFields.length > 0) {
        embed.addFields(engagementFields);
    }
    return embed;
}

module.exports = createRecommendationEmbed;
