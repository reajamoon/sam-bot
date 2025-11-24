
import { EmbedBuilder } from 'discord.js';

/**
 * Builds a paginated search results embed for rec search.
 * @param {Array} recs - Array of Recommendation instances (Sequelize)
 * @param {number} page - Current page (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {string} query - The search query string
 * @returns {EmbedBuilder}
 */
function createSearchResultsEmbed(recs, page, totalPages, query) {
    const embed = new EmbedBuilder()
        .setTitle(`Search Results for "${query}"`)
        .setDescription(`Page ${page} of ${totalPages}`)
        .setColor(0x4F8EDC)
        .setFooter({ text: 'Use the navigation buttons to see more results.' });

    if (!recs.length) {
        embed.setDescription('No results found. Try a different search!');
        return embed;
    }

    for (const rec of recs) {
        const title = rec.title || 'Untitled';
        const author = Array.isArray(rec.authors) ? rec.authors.join(', ') : (rec.author || 'Unknown Author');
        const url = rec.url || '';
        const summary = rec.summary ? (rec.summary.length > 120 ? rec.summary.slice(0, 117) + '...' : rec.summary) : '';
        const rating = rec.rating || 'Unrated';
        const status = rec.status || 'Unknown';
        let wordcount = rec.wordCount;
        if (typeof wordcount === 'string') {
            wordcount = parseInt(wordcount.replace(/,/g, ''), 10);
        }
        wordcount = (typeof wordcount === 'number' && !isNaN(wordcount)) ? wordcount.toLocaleString() : 'N/A';
        // Tags: prefer rec.tags (array or comma string), fallback to empty
        let tags = [];
        if (Array.isArray(rec.tags)) {
            tags = rec.tags;
        } else if (typeof rec.tags === 'string') {
            tags = rec.tags.split(',').map(t => t.trim()).filter(Boolean);
        }
        const tagDisplay = tags.length ? `Tags: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? ', ...' : ''}` : '';
        embed.addFields({
            name: `📖 ${title}`,
            value: `By: ${author}
[Link](${url}) | ${rating} | ${status} | ${wordcount} words${tagDisplay ? ` | ID: ${rec.id}\n${tagDisplay}` : ''}${summary ? `\n>>> ${summary}` : ''}`,
            inline: false
        });
    }
    return embed;
}


export default createSearchResultsEmbed;
