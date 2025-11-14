// Migration script to fix stringified JSON arrays in tags, additionalTags, and archive_warnings fields
// Usage: node scripts/fixStringifiedArrays.js

const { Recommendation } = require('../src/models');

async function fixStringifiedArrays() {
  const recs = await Recommendation.findAll();
  let fixed = 0;
  for (const rec of recs) {
    let needsUpdate = false;
    // Fix tags
    if (typeof rec.tags === 'string') {
      try {
        const arr = JSON.parse(rec.tags);
        if (Array.isArray(arr)) {
          rec.tags = arr;
          needsUpdate = true;
        }
      } catch {}
    }
    // Fix additionalTags
    if (typeof rec.additionalTags === 'string') {
      try {
        const arr = JSON.parse(rec.additionalTags);
        if (Array.isArray(arr)) {
          rec.additionalTags = arr;
          needsUpdate = true;
        }
      } catch {}
    }
    // Fix archive_warnings
    if (typeof rec.archive_warnings === 'string') {
      try {
        const arr = JSON.parse(rec.archive_warnings);
        if (Array.isArray(arr)) {
          rec.archive_warnings = arr;
          needsUpdate = true;
        }
      } catch {}
    }
    if (needsUpdate) {
      await rec.save();
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} recommendations.`);
  process.exit(0);
}

fixStringifiedArrays().catch(e => { console.error(e); process.exit(1); });
