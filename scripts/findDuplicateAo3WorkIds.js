// findDuplicateAo3WorkIds.js
// Script to find duplicate AO3 work IDs in recommendations, with added date and URLs
import { Recommendation, sequelize } from '../src/models/index.js';

function extractAO3WorkId(url) {
  const match = url && url.match(/\/works\/(\d+)/);
  return match ? match[1] : null;
}

async function main() {
  await sequelize.authenticate();
  const recs = await Recommendation.findAll();
  const byAo3Id = {};
  for (const rec of recs) {
    const ao3Id = extractAO3WorkId(rec.url);
    if (!ao3Id) continue;
    if (!byAo3Id[ao3Id]) byAo3Id[ao3Id] = [];
    byAo3Id[ao3Id].push(rec);
  }
  let found = false;
  for (const [ao3Id, recs] of Object.entries(byAo3Id)) {
    if (recs.length > 1) {
      found = true;
      console.log(`Duplicate AO3 workID: ${ao3Id}`);
      for (const rec of recs) {
        const date = rec.createdAt ? new Date(rec.createdAt).toLocaleString() : 'unknown';
        console.log(`  - DB id: ${rec.id}, Added: ${date}, URL: ${rec.url}`);
      }
      console.log('');
    }
  }
  if (!found) {
    console.log('No duplicate AO3 work IDs found.');
  }
  process.exit(0);
}

main();
