const { EmbedBuilder } = require('discord.js');
const { quickLinkCheck } = require('../ficParser');

// Builds the embed for a rec. Checks if the link works, adds warnings if needed.
async function createRecommendationEmbed(rec) {
    const embed = new EmbedBuilder()
        .setTitle(`📖 ${rec.title}`)
        .setDescription(`**By:** ${rec.author}`)
        .setURL(rec.url)
        .setColor(0x9C27B0)
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
    if (rec.rating) fields.push({ name: 'Rating', value: rec.rating, inline: true });
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
