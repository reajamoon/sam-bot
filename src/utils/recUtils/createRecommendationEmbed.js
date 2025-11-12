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
        embed.addFields({
            name: 'Summary',
            value: rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary
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
            linkText += `\n📎 [Backup Copy Available](${rec.attachmentUrl}) *(with permission)*`;
        }
    } else if (!isLinkWorking) {
        linkText += ' ⚠ *Link may be broken or moved*';
    }
    embed.addFields({
        name: '🔗 Story Link',
        value: linkText,
        inline: false
    });
    const fields = [];
    if (rec.rating) {
        let ratingValue = rec.rating;
        if (typeof rec.rating === 'string') {
            const key = rec.rating.trim().toLowerCase();
            if (ratingEmojis[key]) {
                ratingValue = `${ratingEmojis[key]} ${rec.rating}`;
            }
        }
        fields.push({ name: 'Rating', value: ratingValue, inline: true });
    }
    if (rec.wordCount) fields.push({ name: 'Words', value: rec.wordCount.toLocaleString(), inline: true });
    if (rec.chapters) fields.push({ name: 'Chapters', value: rec.chapters, inline: true });
    if (rec.status) {
        let statusValue = rec.status;
        if (rec.deleted) statusValue += ' (Deleted)';
        fields.push({ name: 'Status', value: statusValue, inline: true });
    } else if (rec.deleted) {
        fields.push({ name: 'Status', value: 'Deleted', inline: true });
    }
    if (fields.length > 0) {
        embed.addFields(fields);
    }
    const allTags = rec.getParsedTags();
    if (allTags.length > 0) {
        embed.addFields({
            name: 'Tags',
            value: allTags.slice(0, 8).join(', ') + (allTags.length > 8 ? '...' : '')
        });
    }
    if (rec.notes) {
        embed.addFields({ name: 'Notes', value: rec.notes });
    }
    return embed;
}

module.exports = createRecommendationEmbed;
