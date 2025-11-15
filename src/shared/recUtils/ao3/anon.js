/**
 * Parses AO3 Anonymous fic HTML for title, author, and summary.
 * @param {string} html - Raw AO3 fic HTML
 * @returns {object} Parsed metadata
 */


function parseAnonymousAO3Fic(html, url = null) {
    const metadata = { url };
    // Title
    const titleMatch = html.match(/<h2[^>]*class="title heading"[^>]*>([\s\S]*?)<\/h2>/i);
    metadata.title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown Title';
    // Authors (array, support multiple)
    const authorBlock = html.match(/<h3[^>]*class="byline heading"[^>]*>([\s\S]*?)<\/h3>/i);
    if (authorBlock) {
        // Look for <a> tags (multiple authors), else plain text
        const authorLinks = [...authorBlock[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim());
        if (authorLinks.length > 0) {
            metadata.authors = authorLinks;
        } else {
            const plain = authorBlock[1].replace(/<[^>]+>/g, '').trim();
            metadata.authors = [plain || 'Anonymous'];
        }
    } else {
        metadata.authors = ['Anonymous'];
    }
    // Summary
    const summaryMatch = html.match(/<div[^>]*class="summary module"[^>]*>[\s\S]*?<blockquote class="userstuff">([\s\S]*?)<\/blockquote>/i);
    if (summaryMatch) {
        metadata.summary = summaryMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    } else {
        metadata.summary = '';
    }
    // --- Parse <dl class="work meta group"> block for standard fields ---
    const metaBlockMatch = html.match(/<dl class="work meta group">([\s\S]*?)<\/dl>/);
    if (metaBlockMatch) {
        const metaBlock = metaBlockMatch[0];
        // Rating
        const ratingMatch = metaBlock.match(/<dd class="rating tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.rating = ratingMatch ? ratingMatch[1].trim() : null;
        // Archive Warnings (extract all <a class="tag"> inside <dd class="warning tags">)
        const warningsBlockMatch = metaBlock.match(/<dd class="warning tags">([\s\S]*?)<\/dd>/i);
        metadata.archiveWarnings = [];
        if (warningsBlockMatch) {
            const warningsBlock = warningsBlockMatch[1];
            const warningTagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/g;
            let m;
            while ((m = warningTagRegex.exec(warningsBlock)) !== null) {
                metadata.archiveWarnings.push(m[1].trim());
            }
        }
        console.log('[AO3 PARSER] archiveWarnings for', url, ':', metadata.archiveWarnings);
        // Category
        const categoryMatch = metaBlock.match(/<dd class="category tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.category = categoryMatch ? categoryMatch[1].trim() : null;
        // Fandom
        const fandomMatch = metaBlock.match(/<dd class="fandom tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.fandom = fandomMatch ? fandomMatch[1].trim() : null;
        // Relationships
        const relMatch = metaBlock.match(/<dd class="relationship tags">([\s\S]*?)<\/dd>/);
        metadata.relationships = [];
        if (relMatch) {
            const relRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
            let m;
            while ((m = relRegex.exec(relMatch[1])) !== null) {
                metadata.relationships.push(m[1].trim());
            }
        }
        // Characters
        const charMatch = metaBlock.match(/<dd class="character tags">([\s\S]*?)<\/dd>/);
        metadata.characters = [];
        if (charMatch) {
            const charRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
            let m;
            while ((m = charRegex.exec(charMatch[1])) !== null) {
                metadata.characters.push(m[1].trim());
            }
        }
        // Additional Tags
        const tagMatch = metaBlock.match(/<dd class="freeform tags">([\s\S]*?)<\/dd>/);
        metadata.tags = [];
        if (tagMatch) {
            const tagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
            let m;
            while ((m = tagRegex.exec(tagMatch[1])) !== null) {
                metadata.tags.push(m[1].trim());
            }
        }
        // Language
        const langMatch = metaBlock.match(/<dd class="language" lang="[^"]*">([^<]+)/);
        metadata.language = langMatch ? langMatch[1].trim() : 'English';
        // Collections
        const collMatch = metaBlock.match(/<dd class="collections">([\s\S]*?)<\/dd>/);
        metadata.collections = [];
        if (collMatch) {
            const collRegex = /<a[^>]*>([^<]+)/g;
            let m;
            while ((m = collRegex.exec(collMatch[1])) !== null) {
                metadata.collections.push(m[1].trim());
            }
        }
        // Published date (ISO)
        const publishedMatch = metaBlock.match(/<dt class="published">Published:<\/dt><dd class="published">([^<]+)/);
        if (publishedMatch) {
            const date = new Date(publishedMatch[1].trim());
            metadata.publishedDate = isNaN(date) ? null : date.toISOString().split('T')[0];
        } else {
            metadata.publishedDate = null;
        }
        // Words
        const wordMatch = metaBlock.match(/<dt class="words">Words:<\/dt><dd class="words">([^<]+)/);
        metadata.wordCount = wordMatch ? parseInt(wordMatch[1].replace(/,/g, '')) : null;
        // Chapters
        const chapterMatch = metaBlock.match(/<dt class="chapters">Chapters:<\/dt><dd class="chapters">([^<]+)/);
        metadata.chapters = chapterMatch ? chapterMatch[1].trim() : null;
        // Status (Complete/Work in Progress)
        if (metadata.chapters && metadata.chapters.includes('/')) {
            const [current, total] = metadata.chapters.split('/');
            metadata.status = current === total ? 'Complete' : 'Work in Progress';
        } else {
            metadata.status = null;
        }
        // Comments
        const commentsMatch = metaBlock.match(/<dt class="comments">Comments:<\/dt><dd class="comments">([^<]+)/);
        metadata.comments = commentsMatch ? parseInt(commentsMatch[1].replace(/,/g, '')) : null;
        // Kudos
        const kudosMatch = metaBlock.match(/<dt class="kudos">Kudos:<\/dt><dd class="kudos">([^<]+)/);
        metadata.kudos = kudosMatch ? parseInt(kudosMatch[1].replace(/,/g, '')) : null;
        // Bookmarks
        const bookmarksMatch = metaBlock.match(/<dt class="bookmarks">Bookmarks:<\/dt><dd class="bookmarks">([\s\S]*?)<\/dd>/);
        if (bookmarksMatch) {
            // Bookmarks may be a link or a number
            const numMatch = bookmarksMatch[1].match(/>(\d+)</);
            if (numMatch) {
                metadata.bookmarks = parseInt(numMatch[1]);
            } else {
                metadata.bookmarks = parseInt(bookmarksMatch[1].replace(/<[^>]+>/g, '').replace(/,/g, ''));
            }
        } else {
            metadata.bookmarks = null;
        }
        // Hits
        const hitsMatch = metaBlock.match(/<dt class="hits">Hits:<\/dt><dd class="hits">([^<]+)/);
        metadata.hits = hitsMatch ? parseInt(hitsMatch[1].replace(/,/g, '')) : null;
    }
    return metadata;
}

module.exports = {
    parseAnonymousAO3Fic
};
