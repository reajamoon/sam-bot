// cleanupTags.js
// Script to clean up the tags field for all AO3 recommendations, preserving manual tags in additionalTags.
// Usage: node cleanupTags.js

const { Recommendation } = require('../src/models');
const { fetchFicMetadata } = require('../src/utils/recUtils/ficParser');
const normalizeMetadata = require('../src/utils/recUtils/normalizeMetadata');

async function cleanupTags() {
  const ficId = process.argv[2];
  if (!ficId) {
    console.error('Usage: node cleanupTags.js <ficId>');
    process.exit(1);
  }
  const rec = await Recommendation.findByPk(ficId);
  if (!rec) {
    console.error(`No recommendation found with ID ${ficId}`);
    process.exit(1);
  }
  if (!rec.url || !rec.url.includes('archiveofourown.org')) {
    console.error(`Recommendation ${ficId} is not an AO3 fic.`);
    process.exit(1);
  }
  try {
    // Fetch fresh metadata from AO3
    const metaResult = await fetchFicMetadata(rec.url);
    let metadata = metaResult && metaResult.metadata ? metaResult.metadata : metaResult;
    if (!metadata || metadata.error) {
      console.warn(`[SKIP] Could not fetch metadata for ${rec.url}`);
      process.exit(1);
    }
    // Normalize to get correct freeform tags
    const normalized = normalizeMetadata(metadata, 'ao3');
    const freeformTags = Array.isArray(normalized.tags) ? normalized.tags : [];
    const manualTags = Array.isArray(rec.additionalTags) ? rec.additionalTags : [];
    // Merge and deduplicate
    const mergedTags = Array.from(new Set([...freeformTags, ...manualTags]));
    // Only update if changed
    if (JSON.stringify(rec.tags) !== JSON.stringify(mergedTags)) {
      await rec.update({ tags: mergedTags });
      console.log(`[UPDATE] ${rec.url} - tags cleaned`);
    } else {
      console.log(`[NO CHANGE] ${rec.url} - tags already clean`);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to update ${rec.url}:`, err);
    process.exit(1);
  }
  console.log('Cleanup complete.');
}

cleanupTags().then(() => process.exit(0));
