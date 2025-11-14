// scripts/normalize-ao3-urls.js
// Usage: node scripts/normalize-ao3-urls.js
// Normalizes AO3 URLs in the Recommendation table by removing trailing /chapters/* and deduplicates, keeping the oldest entry.

const { Recommendation } = require('../src/models');
const { Op } = require('sequelize');

function normalizeAo3Url(url) {
    // Only normalize AO3 URLs
    if (!url) return url;
    const ao3Match = url.match(/^https?:\/\/(www\.)?archiveofourown\.org\/works\/\d+(\/chapters\/\d+)?/);
    if (!ao3Match) return url;
    // Remove /chapters/*
    return url.replace(/(\/works\/\d+)(\/chapters\/\d+)?/, '$1');
}

async function main() {
    const recs = await Recommendation.findAll({ order: [['createdAt', 'ASC']] });
    const seen = new Map(); // normalizedUrl -> Recommendation
    const toDelete = [];
    let updated = 0;
    for (const rec of recs) {
        const origUrl = rec.url;
        const normUrl = normalizeAo3Url(origUrl);
        if (origUrl !== normUrl) {
            // Update the URL if it was normalized
            rec.url = normUrl;
            await rec.save();
            updated++;
        }
        if (seen.has(normUrl)) {
            // Duplicate found, mark for deletion (keep the first/oldest)
            toDelete.push(rec.id);
        } else {
            seen.set(normUrl, rec.id);
        }
    }
    if (toDelete.length) {
        await Recommendation.destroy({ where: { id: { [Op.in]: toDelete } } });
    }
    console.log(`Normalized ${updated} URLs. Removed ${toDelete.length} duplicates.`);
}

main().catch(e => { console.error(e); process.exit(1); });
