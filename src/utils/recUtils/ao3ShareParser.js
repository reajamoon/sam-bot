// ao3ShareParser.js
// Utility to parse AO3 share HTML export

function parseAo3ShareHtml(html) {
    // Extract URL, title, author, word count, fandom, rating, warnings, relationships, characters, tags, summary
    const result = {};
    let errors = [];
    // More robust: allow for extra whitespace and missing <strong> tags
    const urlTitleMatch = html.match(/<a href="([^"]+)">(?:<strong>)?([^<]+)(?:<\/strong>)?<\/a>\s*\((\d+) words\) by <a href="([^"]+)">(?:<strong>)?([^<]+)(?:<\/strong>)?<\/a>/);
    if (urlTitleMatch) {
        result.url = urlTitleMatch[1];
        result.title = urlTitleMatch[2];
        result.wordCount = parseInt(urlTitleMatch[3], 10);
        result.authorUrl = urlTitleMatch[4];
        result.author = urlTitleMatch[5];
    } else {
        errors.push('Could not find work URL, title, author, or word count. Make sure you pasted the full AO3 share HTML.');
    }
    // Chapters
    const chaptersMatch = html.match(/Chapters: ([^<]+)<br \/>/);
    if (chaptersMatch) result.chapters = chaptersMatch[1];
    // Fandom
    const fandomMatch = html.match(/Fandom: <a [^>]+>([^<]+)<\/a>/);
    if (fandomMatch) result.fandom = fandomMatch[1];
    // Rating
    const ratingMatch = html.match(/Rating: ([^<]+)<br \/>/);
    if (ratingMatch) result.rating = ratingMatch[1];
    // Warnings
    const warningsMatch = html.match(/Warnings: ([^<]+)<br \/>/);
    if (warningsMatch) result.archiveWarning = warningsMatch[1];
    // Relationships
    const relMatch = html.match(/Relationships: ([^<]+)<br \/>/);
    if (relMatch) result.relationships = relMatch[1].split(',').map(s => s.trim());
    // Characters
    const charMatch = html.match(/Characters: ([^<]+)<br \/>/);
    if (charMatch) result.characters = charMatch[1].split(',').map(s => s.trim());
    // Additional Tags
    const tagsMatch = html.match(/Additional Tags: ([^<]+)<br \/>/);
    if (tagsMatch) result.additionalTags = tagsMatch[1].split(',').map(s => s.trim());
    // Summary
    const summaryMatch = html.match(/Summary: <p>([\s\S]+)<\/p>/);
    if (summaryMatch) result.summary = summaryMatch[1].replace(/<br \/>/g, '\n').trim();
    // Required fields check
    if (!result.url) errors.push('Missing work URL.');
    if (!result.title) errors.push('Missing title.');
    if (!result.author) errors.push('Missing author.');
    if (!result.wordCount) errors.push('Missing word count.');
    if (errors.length > 0) {
        const err = new Error('AO3 share HTML parse error: ' + errors.join(' '));
        err.parseErrors = errors;
        throw err;
    }
    return result;
}

module.exports = { parseAo3ShareHtml };