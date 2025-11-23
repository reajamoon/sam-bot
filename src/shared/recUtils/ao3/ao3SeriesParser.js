// ao3SeriesParser.js
// Extracts metadata for AO3 series pages

const cheerio = require('cheerio');
const fs = require('fs');

/**
 * Parses AO3 series HTML and returns structured metadata
 * @param {string} html - Raw AO3 series HTML
 * @param {string} url - Series URL
 * @returns {object} Series metadata
 */
function parseAO3SeriesMetadata(html, url) {
    const $ = cheerio.load(html);
    const metadata = { url, type: 'series' };

    // Title
    metadata.title = $('h2.heading').first().text().trim() || 'Unknown Title';

    // Authors (array)
    metadata.authors = [];
    $('h3.byline.heading a[rel="author"]').each((i, el) => {
        metadata.authors.push($(el).text().trim());
    });
    if (metadata.authors.length === 0) {
        // Fallback: orphan_account or Anonymous
        const byline = $('h3.byline.heading').first().text().replace(/^by\s+/i, '').trim();
        if (byline) metadata.authors.push(byline);
    }

    // Summary/Description
    metadata.summary = $('div.summary.module blockquote.userstuff').first().text().trim();

    // List of works in the series
    metadata.works = [];
    $('ul.series.work.index.group li.work').each((i, el) => {
        const work = {};
        const workEl = $(el);
        // Title and URL
        const titleLink = workEl.find('h4.heading a').first();
        work.title = titleLink.text().trim();
        work.url = titleLink.attr('href') ? 'https://archiveofourown.org' + titleLink.attr('href') : null;
        // Authors
        work.authors = [];
        titleLink.parent().parent().find('a[rel="author"]').each((j, ael) => {
            work.authors.push($(ael).text().trim());
        });
        // Summary (optional)
        const workSummary = workEl.find('blockquote.userstuff').first().text().trim();
        if (workSummary) work.summary = workSummary;
        metadata.works.push(work);
    });

    // Series stats (works, word count, etc.)
    const statsText = $('dl.series.meta.group').text();
    const worksMatch = statsText.match(/Works:\s*(\d+)/i);
    if (worksMatch) metadata.workCount = parseInt(worksMatch[1], 10);
    const wordsMatch = statsText.match(/Words:\s*([\d,]+)/i);
    if (wordsMatch) metadata.wordCount = parseInt(wordsMatch[1].replace(/,/g, ''), 10);

    // Extract tags (fandoms, characters, relationships, freeforms, archive warnings)
    // AO3 series tags are in .tags.commas (like works)
    metadata.fandom_tags = [];
    metadata.character_tags = [];
    metadata.relationship_tags = [];
    metadata.freeform_tags = [];
    metadata.archive_warnings = [];
    $('dd.fandom.tags.commas a.tag').each((i, el) => metadata.fandom_tags.push($(el).text().trim()));
    $('dd.character.tags.commas a.tag').each((i, el) => metadata.character_tags.push($(el).text().trim()));
    $('dd.relationship.tags.commas a.tag').each((i, el) => metadata.relationship_tags.push($(el).text().trim()));
    $('dd.freeform.tags.commas a.tag').each((i, el) => metadata.freeform_tags.push($(el).text().trim()));
    $('dd.warning.tags.commas a.tag').each((i, el) => metadata.archive_warnings.push($(el).text().trim()));

    // Extract rating (if present)
    const ratingTag = $('dd.rating.tags.commas a.tag').first();
    if (ratingTag.length) metadata.rating = ratingTag.text().trim();

    // Extract status (Complete/Incomplete)
    // AO3 series status is in <dt>Status:</dt><dd>Complete/Incomplete</dd>
    const statusLabel = $('dt:contains("Status:")');
    if (statusLabel.length) {
        const statusValue = statusLabel.next('dd').text().trim();
        if (statusValue) metadata.status = statusValue;
    }

    return metadata;
}

module.exports = { parseAO3SeriesMetadata };
