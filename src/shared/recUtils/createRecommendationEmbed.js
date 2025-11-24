const { EmbedBuilder } = require('discord.js');
const quickLinkCheck = require('./quickLinkCheck');

// Map AO3 normalized rating names to custom emoji
const ratingEmojis = {
    'general audiences': '<:ratinggeneral:1133762158077935749>',
    'teen and up audiences': '<:ratingteen:1133762194174136390>',
    'mature': '<:ratingmature:1133762226738700390>',
    'explicit': '<:ratingexplicit:1133762272087506965>'
};

// Helper to add warnings field to embed
function addWarningsField(embed, warnings, majorWarningEmoji, maybeWarningEmoji, majorWarningsList) {
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

// Helper to add tags field
function addTagsField(embed, tags) {
    if (Array.isArray(tags) && tags.length > 0) {
        let tagString = '';
        let i = 0;
        while (i < tags.length) {
            const next = tagString.length === 0 ? tags[i] : ', ' + tags[i];
            if ((tagString + next).length > 1021) { // 1021 to allow for '...'
                tagString += '...';
                break;
            }
            tagString += next;
            i++;
        }
        embed.addFields({
            name: 'Tags',
            value: tagString,
            inline: false
        });
    }
}

async function createRecommendationEmbed(rec) {
    // Always convert Sequelize instance to plain object
    if (rec && typeof rec.get === 'function') {
        rec = rec.get({ plain: true });
    }
    // If this is a series rec (type === 'series' or url includes '/series/' or has series_works and not notPrimaryWork), use series embed
    const isSeries = (rec.type === 'series') || (rec.url && rec.url.includes('/series/')) || (Array.isArray(rec.series_works) && rec.series_works.length > 0 && !rec.notPrimaryWork);
    if (isSeries) {
        return await createSeriesEmbed(rec);
    } else {
        return await createWorkEmbed(rec);
    }
}

// Embed for main series rec (shows series info and works list)
async function createSeriesEmbed(rec) {
    const ratingColors = {
        'general audiences': 0x43a047,
        'teen and up audiences': 0xffeb3b,
        'mature': 0xff9800,
        'explicit': 0xd32f2f,
        'not rated': 0x757575,
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
        .setURL(rec.url)
        .setColor(color)
        .setTimestamp()
        .setFooter({
            text: `From the Profound Bond Library • Recommended by ${rec.recommendedByUsername} • ID: ${rec.id}`
        });
    let authorLine = 'Unknown Author';
    if (Array.isArray(rec.authors) && rec.authors.length > 0) {
        authorLine = rec.authors.join(', ');
    } else if (typeof rec.author === 'string' && rec.author.trim()) {
        authorLine = rec.author.trim();
    }
    let desc = `**By:** ${authorLine}`;
    let summary = rec.summary;
    if (!summary && Array.isArray(rec.series_works) && rec.series_works.length > 0) {
        // Use summary from the first work in the series that is not flagged with notPrimaryWork
        const primaryWork = rec.series_works.find(w => !w.notPrimaryWork);
        summary = primaryWork?.summary;
    }
    if (summary) {
        desc += `\n\n${summary}`;
    }
    embed.setDescription(desc);
    // Determine rating: use series rating, or highest from works if not rated
    let ratingToShow = rec.rating;
    if (!ratingToShow && Array.isArray(rec.series_works) && rec.series_works.length > 0) {
        // Priority: explicit > mature > teen and up audiences > general audiences > not rated
        const ratingOrder = [
            'explicit',
            'mature',
            'teen and up audiences',
            'general audiences',
            'not rated',
            'unrated'
        ];
        const found = {};
        for (const work of rec.series_works) {
            if (work.rating && typeof work.rating === 'string') {
                const key = work.rating.trim().toLowerCase();
                found[key] = true;
            }
        }
        ratingToShow = ratingOrder.find(r => found[r]);
    }
    if (ratingToShow && typeof ratingToShow === 'string') {
        const ratingKey = ratingToShow.trim().toLowerCase();
        if (ratingEmojis[ratingKey]) {
            embed.addFields({ name: 'Rating', value: `${ratingEmojis[ratingKey]} ${ratingToShow}`, inline: true });
        } else {
            embed.addFields({ name: 'Rating', value: ratingToShow, inline: true });
        }
    }
    addTagsField(embed, rec.tags);

    // Archive warnings: concatenate and deduplicate from all works in the series
    let allWarnings = [];
    if (Array.isArray(rec.series_works) && rec.series_works.length > 0) {
        for (const work of rec.series_works) {
            if (Array.isArray(work.archive_warnings)) {
                allWarnings.push(...work.archive_warnings);
            } else if (Array.isArray(work.archiveWarnings)) {
                allWarnings.push(...work.archiveWarnings);
            }
        }
    }
    if (Array.isArray(rec.archive_warnings)) {
        allWarnings.push(...rec.archive_warnings);
    } else if (Array.isArray(rec.archiveWarnings)) {
        allWarnings.push(...rec.archiveWarnings);
    }
    allWarnings = allWarnings.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean);
    allWarnings = [...new Set(allWarnings)];
    addWarningsField(
        embed,
        allWarnings,
        '<:warn_yes:1142772202379415622>',
        '<:warn_maybe:1142772269156933733>',
        [
            'Graphic Depictions of Violence',
            'Major Character Death',
            'Rape/Non-Con',
            'Underage',
            'Underage Sex'
        ]
    );
        // Aggregate engagement fields for series (sum across all works)
        let totalHits = 0, totalKudos = 0, totalBookmarks = 0;
        if (Array.isArray(rec.series_works)) {
            for (const work of rec.series_works) {
                if (typeof work.hits === 'number') totalHits += work.hits;
                if (typeof work.kudos === 'number') totalKudos += work.kudos;
                if (typeof work.bookmarks === 'number') totalBookmarks += work.bookmarks;
            }
        }
        const engagementFields = [];
        if (totalHits) engagementFields.push({ name: 'Hits', value: totalHits.toLocaleString(), inline: true });
        if (totalKudos) engagementFields.push({ name: 'Kudos', value: totalKudos.toLocaleString(), inline: true });
        if (totalBookmarks) engagementFields.push({ name: 'Bookmarks', value: totalBookmarks.toLocaleString(), inline: true });
        if (engagementFields.length > 0) {
            embed.addFields(engagementFields);
        }
    // Show works in series
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
            worksList += `... [and more](${rec.url})`;
        }
        embed.addFields({
            name: 'Series Works',
            value: worksList.trim(),
            inline: false
        });
    }
    return embed;
}

// Embed for individual works (shows only work info, not series list)
async function createWorkEmbed(rec) {
    const ratingColors = {
        // Author line
        let authorLine = 'Unknown Author';
        if (Array.isArray(rec.authors) && rec.authors.length > 0) {
            authorLine = rec.authors.join(', ');
        } else if (typeof rec.author === 'string' && rec.author.trim()) {
            authorLine = rec.author.trim();
        }
        embed.addFields({ name: '\u200B', value: `**By:** ${authorLine}`, inline: false });

        // Summary blockquote
        if (rec.summary) {
            embed.addFields({ name: 'Summary', value: `> ${rec.summary.replace(/\n/g, '\n> ')}`, inline: false });
        }

        // Story Link, Rating, Status row
        const linkField = { name: '\uD83D\uDD17 Story Link', value: `[Read on Ao3](${rec.url})`, inline: true };
        let ratingField = { name: 'Rating', value: rec.rating || 'Unknown', inline: true };
        if (rec.rating && typeof rec.rating === 'string') {
            const ratingKey = rec.rating.trim().toLowerCase();
            if (ratingEmojis[ratingKey]) {
                ratingField.value = `${ratingEmojis[ratingKey]} ${rec.rating}`;
            }
        }
        const statusField = { name: 'Status', value: rec.status || 'Unknown', inline: true };
        embed.addFields([linkField, ratingField, statusField]);

        // Published, Chapters, Words row
        embed.addFields([
            { name: 'Published', value: rec.publishedDate || 'Unknown', inline: true },
            { name: 'Chapters', value: rec.chapters || 'Unknown', inline: true },
            { name: 'Words', value: (typeof rec.wordCount === 'number' && rec.wordCount > 0) ? rec.wordCount.toLocaleString() : 'Unknown', inline: true }
        ]);

        // Major Content Warnings
        let warnings = typeof rec.getArchiveWarnings === 'function' ? rec.getArchiveWarnings() : [];
        warnings = warnings.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean);
        warnings = [...new Set(warnings)];
        if (warnings.length > 0 && !(warnings.length === 1 && warnings[0].toLowerCase() === 'no archive warnings apply')) {
            addWarningsField(
                embed,
                warnings,
                '<:warn_yes:1142772202379415622>',
                '<:warn_maybe:1142772269156933733>',
                [
                    'Graphic Depictions of Violence',
                    'Major Character Death',
                    'Rape/Non-Con',
                    'Underage',
                    'Underage Sex'
                ]
            );
        }

        // Tags
        addTagsField(embed, rec.tags);

        // Hits, Kudos, Bookmarks row
        embed.addFields([
            { name: 'Hits', value: (typeof rec.hits === 'number' && rec.hits > 0) ? rec.hits.toLocaleString() : '0', inline: true },
            { name: 'Kudos', value: (typeof rec.kudos === 'number' && rec.kudos > 0) ? rec.kudos.toLocaleString() : '0', inline: true },
            { name: 'Bookmarks', value: (typeof rec.bookmarks === 'number' && rec.bookmarks > 0) ? rec.bookmarks.toLocaleString() : '0', inline: true }
        ]);

        return embed;
    }
module.exports = createRecommendationEmbed;
