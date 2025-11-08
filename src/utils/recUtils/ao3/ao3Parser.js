// ao3Parser.js
// AO3 HTML parsing logic

function parseAO3Metadata(html, url, includeRawHtml = false) {
    if (!html) return null;
    // Check for AO3 'New Session' interstitial
    if (html.includes('<title>New Session') || html.includes('Please log in to continue') || html.includes('name="user_session"')) {
        return {
            title: 'Unknown Title',
            author: 'Unknown Author',
            url: url,
            error: 'AO3 session required',
            summary: 'AO3 is requiring a login or new session. Please log in to AO3 and try again.'
        };
    }
    // Check for Cloudflare or other protection
    if (html.includes('challenge') || html.includes('cloudflare') || html.includes('Enable JavaScript')) {
        return {
            title: 'Unknown Title',
            author: 'Unknown Author',
            url: url,
            error: 'Site protection detected',
            summary: 'Site protection is blocking metadata fetch.'
        };
    }
    const metadata = { url: url };
    const metaBlockMatch = html.match(/<dl class="work meta group">([\s\S]*?)<\/dl>/);
    const metaBlock = metaBlockMatch ? metaBlockMatch[0] : '';
    const h2TitleMatch = html.match(/<h2 class="title heading">([\s\S]*?)<\/h2>/);
    if (h2TitleMatch) {
        let titleText = h2TitleMatch[1].replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        metadata.title = titleText || 'Unknown Title';
    } else {
        metadata.title = 'Unknown Title';
    }
    const authorMatch = html.match(/<a rel="author" href="[^"]*">([^<]+)/);
    metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';
    const summaryMatch = html.match(/<div class="summary module">[\s\S]*?<blockquote class="userstuff">\s*<p>([\s\S]*?)<\/p>/);
    if (summaryMatch) {
        metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    const fandomMatch = metaBlock.match(/<dd class="fandom tags">[\s\S]*?<a[^>]*>([^<]+)/);
    metadata.fandom = fandomMatch ? fandomMatch[1].trim() : null;
    const ratingMatch = metaBlock.match(/<dd class="rating tags">[\s\S]*?<a[^>]*>([^<]+)/);
    metadata.rating = ratingMatch ? ratingMatch[1].trim() : null;
    const wordMatch = metaBlock.match(/<dt class="words">Words:<\/dt><dd class="words">([^<]+)/);
    if (wordMatch) {
        metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
    }
    const chapterMatch = metaBlock.match(/<dt class="chapters">Chapters:<\/dt><dd class="chapters">([^<]+)/);
    metadata.chapters = chapterMatch ? chapterMatch[1].trim() : null;
    if (metadata.chapters && metadata.chapters.includes('/')) {
        const [current, total] = metadata.chapters.split('/');
        metadata.status = current === total ? 'Complete' : 'Work in Progress';
    }
    const tagMatches = metaBlock.match(/<dd class="freeform tags">[\s\S]*?<\/dd>/);
    if (tagMatches) {
        const tagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
        metadata.tags = [];
        let tagMatch;
        while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
            metadata.tags.push(tagMatch[1].trim());
        }
    }
    const langMatch = metaBlock.match(/<dd class="language" lang="[^"]*">([^<]+)/);
    metadata.language = langMatch ? langMatch[1].trim() : 'English';
    const publishedMatch = metaBlock.match(/<dt class="published">Published:<\/dt><dd class="published">([^<]+)/);
    if (publishedMatch) {
        metadata.publishedDate = new Date(publishedMatch[1].trim()).toISOString().split('T')[0];
    }
    const updatedMatch = metaBlock.match(/<dt class="status">Completed:<\/dt><dd class="status">([^<]+)/);
    if (updatedMatch) {
        metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
    }
    if (includeRawHtml) metadata.rawHtml = html;
    return metadata;
}

module.exports = { parseAO3Metadata };
