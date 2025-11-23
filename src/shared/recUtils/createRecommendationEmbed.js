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
    // Map fic ratings to embed colors
    const ratingColors = {
        'general audiences': 0x43a047,      // Green
        'teen and up audiences': 0xffeb3b, // Yellow
        'mature': 0xff9800,                // Orange
        'explicit': 0xd32f2f,              // Red
        'not rated': 0x757575,             // Grey
        'unrated': 0x757575
    };
    let color = 0x333333;
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
    if (Array.isArray(rec.series_works) && rec.series_works.length > 0) {
        let worksList = '';
        const maxToShow = 4;
        for (let i = 0; i < Math.min(rec.series_works.length, maxToShow); i++) {
            const work = rec.series_works[i];
            if (work && work.title && work.url) {
                worksList += `${i + 1}. [${work.title}](${work.url})\n`;
            } else if (work && work.title) {
                worksList += `${i + 1}. ${work.title}\n`;
            }
        }
        if (rec.series_works.length > maxToShow) {
            // Add "and more" link to series page
            worksList += `... [and more](${rec.url})`;
        }
        embed.addFields({
            name: 'Series Works',
            value: worksList.trim(),
            inline: false
        });
    }
    // DEBUG: Log the rec object and tag fields to inspect tag presence
    //console.log('[DEBUG] createRecommendationEmbed rec:', JSON.stringify(rec, null, 2));
    if (typeof rec.getParsedTags === 'function') {
        const parsedTags = rec.getParsedTags();
        //console.log('[DEBUG] getParsedTags() result:', parsedTags);
        //} else {
        //console.log('[DEBUG] getParsedTags() not a function. tags:', rec.tags, 'additionalTags:', rec.additionalTags);
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

    // (Removed duplicate block)

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
