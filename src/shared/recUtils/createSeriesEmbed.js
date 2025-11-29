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
 * Find the oldest work in a series by date - use this instead of array position
 * to ensure prequels aren't falsely selected as primary works
 */
function findOldestWork(works) {
    if (!works || works.length === 0) return null;
    // Sort works by: publishedDate (earliest first), then updatedDate, then createdAt
    return works.sort((a, b) => {
        // Try published date first
        if (a.publishedDate && b.publishedDate) {
            const dateA = new Date(a.publishedDate);
            const dateB = new Date(b.publishedDate);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
        }
        // If published dates are same/missing, try updated date
        if (a.updatedDate && b.updatedDate) {
            const dateA = new Date(a.updatedDate);
            const dateB = new Date(b.updatedDate);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
        }
        // Final fallback: creation date in database
        if (a.createdAt && b.createdAt) {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateA.getTime() - dateB.getTime();
        }
        return 0;
    })[0];
}

/**
 * Get color based on rating, with fallback to primary work
 */
function getSeriesRatingColor(rating, series) {
    if (rating) return getAo3RatingColor(rating.toLowerCase());

    // Fallback: get rating from primary work if series rating is null
    if (series && series.works && series.works.length > 0) {
        const primaryWork = series.works.find(work => !work.notPrimaryWork) || findOldestWork(series.works);
        if (primaryWork && primaryWork.rating) {
            return getAo3RatingColor(primaryWork.rating.toLowerCase());
        }
    }
    return getAo3RatingColor('not rated');
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
 * Get site-specific link content for the Series Link field
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
 * Combine and deduplicate tags from series works and user metadata, prioritizing title case
 */
function processTagsForEmbed(series) {
    const allTags = [];

    // Add tags from all works in the series
    if (series.works && Array.isArray(series.works)) {
        for (const work of series.works) {
            if (work.tags && Array.isArray(work.tags)) {
                allTags.push(...work.tags);
            }
        }
    }

    // Add all users' additional tags from UserFicMetadata
    if (series.userMetadata && series.userMetadata.length > 0) {
        for (const userMeta of series.userMetadata) {
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
 * Get randomized user notes from UserFicMetadata for the series
 */
function getRandomUserNotes(series) {
    if (!series.userMetadata || series.userMetadata.length === 0) return null;

    const usersWithNotes = series.userMetadata.filter(meta => meta.rec_note);
    if (usersWithNotes.length === 0) return null;

    // Randomize which user's notes to show
    const randomUserMeta = usersWithNotes[Math.floor(Math.random() * usersWithNotes.length)];
    return randomUserMeta.rec_note || null;
}

// ================== MAIN EMBED FUNCTION ==================

/**
 * Creates an embed for a series from the Series table
 * @param {Object} series - Series object from database
 * @returns {EmbedBuilder}
 */
export function createSeriesEmbed(series) {
    if (!series) {
        throw new Error('Series data is required');
    }

    // Build author description line
    const author = Array.isArray(series.authors) ? series.authors.join(', ') : (series.author || 'Unknown Author');
    const authorLine = `**Series by:** ${author}`;

    // Add summary if available, separated by newlines
    let description = authorLine;
    if (series.summary) {
        const summaryText = series.summary.length > 400 ? series.summary.substring(0, 400) + '...' : series.summary;
        description += `\n\n>>> ${summaryText}`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📚 ${series.name || 'Untitled Series'}`)
        .setURL(series.url || '')
        .setDescription(description)
        .setColor(getSeriesRatingColor(series.rating, series));

    // Series Link, Rating, Status row (inline group)
    if (series.url) {
        let linkContent;
        // Handle deleted series - show "Deleted" text and add backup link if available
        if (series.deleted) {
            linkContent = 'Deleted';
            if (series.attachmentUrl) {
                linkContent += ` • [📎 Backup Available](${series.attachmentUrl})`;
            }
        } else {
            linkContent = getSiteLinkContent(series.url).replace(/\[(.+)\]/, `[$1](${series.url})`);
        }
        embed.addFields({ name: '🔗 Series Link', value: linkContent, inline: true });
    }
    embed.addFields({ name: 'Rating', value: formatRatingWithEmoji(series.rating), inline: true });
    embed.addFields({ name: 'Status', value: series.status || 'Unknown', inline: true });

    // Works, Words, and Updated row (inline group)
    embed.addFields({ name: 'Works', value: series.workCount ? series.workCount.toString() : 'Unknown', inline: true });
    embed.addFields({ name: 'Words', value: formatWordCount(series.wordCount), inline: true });
    if (series.updatedDate) {
        embed.addFields({ name: 'Updated', value: formatDate(series.updatedDate), inline: true });
    }

    // Archive Warnings (aggregate from works)
    if (series.works && Array.isArray(series.works)) {
        const allWarnings = [];
        for (const work of series.works) {
            if (work.archiveWarnings && Array.isArray(work.archiveWarnings)) {
                allWarnings.push(...work.archiveWarnings);
            }
        }
        // Only show warnings if there are actual warnings beyond "no archive warnings apply"
        const significantWarnings = allWarnings.filter(w =>
            w && w.toLowerCase() !== 'no archive warnings apply'
        );
        if (significantWarnings.length > 0) {
            // Remove duplicates while preserving original case
            const uniqueWarnings = [...new Set(significantWarnings)];
            const formattedWarnings = formatArchiveWarnings(uniqueWarnings);
            if (formattedWarnings) {
                embed.addFields({ name: 'Archive Warnings', value: formattedWarnings, inline: false });
            }
        }
        // If all works have "no archive warnings apply", don't show anything (hidden)
        // If any work has "creator chose not to use archive warnings", it will be included and formatted with the maybe emoji
    }

    // Tags
    const tagText = processTagsForEmbed(series);
    if (tagText) {
        embed.addFields({ name: 'Tags', value: tagText, inline: false });
    }

    // Works in Series (show first few works)
    if (series.works && Array.isArray(series.works) && series.works.length > 0) {
        const maxToShow = 5;
        let worksList = '';
        const worksToDisplay = series.works.slice(0, maxToShow);
        for (let i = 0; i < worksToDisplay.length; i++) {
            const work = worksToDisplay[i];
            const title = work.title || `Work ${i + 1}`;
            const url = work.url || `https://archiveofourown.org/works/${work.ao3ID || work.id}`;
            worksList += `${i + 1}. [${title}](${url})\n`;
        }
        if (series.workCount && series.workCount > maxToShow) {
            worksList += `... and ${series.workCount - maxToShow} more works`;
        }
        embed.addFields({ name: `Works in Series (${series.workCount || series.works.length})`, value: worksList.trim(), inline: false });
    }

    // Recommender Notes
    const userNotes = getRandomUserNotes(series);
    if (userNotes) {
        embed.addFields({ name: 'Recommender Notes:', value: userNotes, inline: false });
    }

    // Footer with series info
    const recommenderName = series.recommendedByUsername || 'unknown';
    embed.setFooter({ text: `From the Profound Bond Library • Recommended by ${recommenderName} • Series ID: S${series.id}` });

    return embed;
}