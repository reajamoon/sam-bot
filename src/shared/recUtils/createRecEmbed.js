import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { getAo3RatingColor } from './ao3/ao3TagColors.js';
import { formatRatingWithEmoji, formatArchiveWarnings } from './ao3Emojis.js';
import { detectSiteAndExtractIDs } from './processUserMetadata.js';

// ================== UTILITY FUNCTIONS ==================

/**
 * Check if a string is in title case (Where Each Word Is Capitalized)
 */
function isTitleCase(str) {
    const words = str.split(' ');
    return words.every(word => {
        if (word.length === 0) return true;
        // First character should be uppercase, rest lowercase (except for apostrophes/hyphens)
        const firstChar = word.charAt(0);
        const rest = word.slice(1);
        return firstChar === firstChar.toUpperCase() &&
               rest.split(/[-']/).every(part => part === part.toLowerCase());
    });
}

/**
 * Get color based on rating
 */
function getRatingColor(rating) {
    if (!rating) return getAo3RatingColor('not rated');
    return getAo3RatingColor(rating.toLowerCase());
}

/**
 * Format word count with proper number formatting
 */
function formatWordCount(wordCount) {
    if (!wordCount) return 'N/A';
    if (typeof wordCount === 'string') {
        wordCount = parseInt(wordCount.replace(/,/g, ''), 10);
    }
    return (typeof wordCount === 'number' && !isNaN(wordCount)) ? wordCount.toLocaleString() : 'N/A';
}

/**
 * Format numbers with locale-specific formatting
 */
function formatNumber(num) {
    if (!num) return null;
    if (typeof num === 'string') {
        num = parseInt(num.replace(/,/g, ''), 10);
    }
    return (typeof num === 'number' && !isNaN(num)) ? num.toLocaleString() : null;
}

/**
 * Format date string to readable format
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
        return dateStr; // Return original if parsing fails
    }
}

/**
 * Get site-specific link content for the Story Link field
 */
function getSiteLinkContent(url) {
    const siteInfo = detectSiteAndExtractIDs(url);
    if (siteInfo && siteInfo.site) {
        switch (siteInfo.site) {
            case 'ao3': return '[Read on AO3 Here]';
            case 'ffnet': return '[Read on FF.net Here]';
            case 'wattpad': return '[Read on Wattpad Here]';
            case 'tumblr': return '[Read on Tumblr Here]';
            case 'dreamwidth': return '[Read on Dreamwidth Here]';
            case 'livejournal': return '[Read on LiveJournal Here]';
            default: return '[Read Here]';
        }
    }

    return '[Read Here]';
}

// ================== TAG PROCESSING ==================

/**
 * Combine and deduplicate tags from AO3 and user metadata, prioritizing title case
 */
function processTagsForEmbed(rec) {
    const allTags = [];

    // Add AO3 freeform tags
    if (rec.tags && Array.isArray(rec.tags)) {
        allTags.push(...rec.tags);
    }

    // Add all users' additional tags
    if (rec.userMetadata && rec.userMetadata.length > 0) {
        for (const userMeta of rec.userMetadata) {
            if (userMeta.additional_tags && Array.isArray(userMeta.additional_tags)) {
                allTags.push(...userMeta.additional_tags);
            }
        }
    }

    if (allTags.length === 0) return null;

    // Deduplicate using normalized versions but prioritize title case for display
    const seen = new Set();
    const uniqueTags = [];

    for (const tag of allTags) {
        const normalized = tag.trim().toLowerCase();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            uniqueTags.push(tag);
        } else {
            // We've seen this tag before, but check if this version is title case
            const existingIndex = uniqueTags.findIndex(existing => existing.toLowerCase() === normalized);
            if (existingIndex >= 0 && isTitleCase(tag) && !isTitleCase(uniqueTags[existingIndex])) {
                uniqueTags[existingIndex] = tag;
            }
        }
    }

    const tagText = uniqueTags.join(', ');
    return tagText.length > 1024 ? tagText.slice(0, 1021) + '...' : tagText;
}

// ================== USER NOTES PROCESSING ==================

/**
 * Get randomized user notes from UserFicMetadata
 */
function getRandomUserNotes(rec) {
    if (!rec.userMetadata || rec.userMetadata.length === 0) return null;

    const usersWithNotes = rec.userMetadata.filter(meta => meta.rec_note);
    if (usersWithNotes.length === 0) return null;

    // Randomize which user's notes to show
    const randomUserMeta = usersWithNotes[Math.floor(Math.random() * usersWithNotes.length)];
    return randomUserMeta.rec_note || null;
}

// ================== MAIN EMBED FUNCTION ==================

/**
 * Creates an embed for an individual recommendation
 * @param {Object} rec - Recommendation object from database
 * @returns {EmbedBuilder}
 */
export function createRecEmbed(rec) {
    if (!rec) {
        throw new Error('Recommendation data is required');
    }

    // Build author description line
    const author = Array.isArray(rec.authors) ? rec.authors.join(', ') : (rec.author || 'Unknown Author');
    const authorLine = `**By:** ${author}`;
    
    // Add summary if available, separated by newlines
    let description = authorLine;
    if (rec.summary) {
        const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
        description += `\n\n>>> ${summaryText}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(rec.title || 'Untitled')
        .setURL(rec.url || '')
        .setDescription(description)
        .setColor(getRatingColor(rec.rating));

    // Story Link, Rating, Status row (inline group)
    if (rec.url) {
        let linkContent;
        // Handle deleted stories - show "Deleted" text and add backup link if available
        if (rec.deleted) {
            linkContent = 'Deleted';
            if (rec.attachmentUrl) {
                linkContent += ` • [📎 Backup Available](${rec.attachmentUrl})`;
            }
        } else {
            linkContent = getSiteLinkContent(rec.url).replace(/\[(.+)\]/, `[$1](${rec.url})`);
        }
        embed.addFields({ name: '🔗 Story Link', value: linkContent, inline: true });
    }
    embed.addFields({ name: 'Rating', value: formatRatingWithEmoji(rec.rating), inline: true });
    embed.addFields({ name: 'Status', value: rec.status || 'Unknown', inline: true });

    // Published date, Chapters, Words row (inline group)
    if (rec.publishedDate) {
        embed.addFields({ name: 'Published', value: formatDate(rec.publishedDate), inline: true });
    }
    if (rec.chapters) {
        embed.addFields({ name: 'Chapters', value: rec.chapters.toString(), inline: true });
    }
    embed.addFields({ name: 'Words', value: formatWordCount(rec.wordCount), inline: true });

    // Archive Warnings
    const formattedWarnings = formatArchiveWarnings(rec.archiveWarnings);
    if (formattedWarnings) {
        embed.addFields({ name: 'Archive Warnings', value: formattedWarnings, inline: false });
    }

    // Series (if this work is part of a series)
    if (rec.series && rec.series.name && rec.series.url) {
        let seriesText = `[${rec.series.name}](${rec.series.url})`;
        if (rec.part) {
            seriesText = `Part ${rec.part} of ${seriesText}`;
        }
        embed.addFields({ name: '📚 Series', value: seriesText, inline: false });
    }

    // Tags
    const tagText = processTagsForEmbed(rec);
    if (tagText) {
        embed.addFields({ name: 'Tags', value: tagText, inline: false });
    }

    // Engagement stats (Hits, Kudos, Bookmarks)
    if (rec.hits || rec.kudos || rec.bookmarks) {
        embed.addFields({ name: 'Hits', value: formatNumber(rec.hits) || 'N/A', inline: true });
        embed.addFields({ name: 'Kudos', value: formatNumber(rec.kudos) || 'N/A', inline: true });
        embed.addFields({ name: 'Bookmarks', value: formatNumber(rec.bookmarks) || 'N/A', inline: true });
    }

    // Recommender Notes
    const userNotes = getRandomUserNotes(rec);
    if (userNotes) {
        embed.addFields({ name: 'Recommender Notes:', value: userNotes, inline: false });
    }

    // Footer with recommender info
    const recommenderName = rec.recommendedByUsername || 'unknown';
    embed.setFooter({ text: `From the Profound Bond Library • Recommended by ${recommenderName} • ID: ${rec.id}` });

    return embed;
}