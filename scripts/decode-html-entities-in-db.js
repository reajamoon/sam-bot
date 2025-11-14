// scripts/decode-html-entities-in-db.js
// Usage: node scripts/decode-html-entities-in-db.js
// Decodes HTML entities in tags, title, and summary for all recommendations in the database.

const { Recommendation } = require('../src/models');
const decodeHtmlEntities = require('../src/utils/recUtils/decodeHtmlEntities');

async function main() {
    const recs = await Recommendation.findAll();
    let updated = 0;
    for (const rec of recs) {
        let changed = false;
        // Title
        if (rec.title && /&[a-zA-Z#0-9]+;/.test(rec.title)) {
            const decoded = decodeHtmlEntities(rec.title);
            if (decoded !== rec.title) {
                rec.title = decoded;
                changed = true;
            }
        }
        // Summary
        if (rec.summary && /&[a-zA-Z#0-9]+;/.test(rec.summary)) {
            const decoded = decodeHtmlEntities(rec.summary);
            if (decoded !== rec.summary) {
                rec.summary = decoded;
                changed = true;
            }
        }
        // Tags (array or string)
        if (Array.isArray(rec.tags)) {
            const decodedTags = rec.tags.map(tag => decodeHtmlEntities(tag));
            if (JSON.stringify(decodedTags) !== JSON.stringify(rec.tags)) {
                rec.tags = decodedTags;
                changed = true;
            }
        } else if (typeof rec.tags === 'string' && /&[a-zA-Z#0-9]+;/.test(rec.tags)) {
            const decoded = decodeHtmlEntities(rec.tags);
            if (decoded !== rec.tags) {
                rec.tags = decoded;
                changed = true;
            }
        }
        if (changed) {
            await rec.save();
            updated++;
        }
    }
    console.log(`Decoded HTML entities for ${updated} recommendations.`);
}

main().catch(e => { console.error(e); process.exit(1); });
