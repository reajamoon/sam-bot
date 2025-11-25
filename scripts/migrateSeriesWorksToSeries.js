// migrateSeriesWorksToSeries.js
// Migrates deprecated Recommendation.series_works to Series.series_works, matching by seriesId and workIds

import { Recommendation, Series, sequelize } from '../src/models/index.js';

async function migrateSeriesWorks() {
  // 1. Fetch all Recommendations with non-null series_works and a valid seriesId
  const recs = await Recommendation.findAll({
    where: {
      series_works: { [sequelize.Op.ne]: null },
      seriesId: { [sequelize.Op.ne]: null }
    },
    raw: true
  });

  // 2. Group by seriesId
  const seriesMap = new Map();
  for (const rec of recs) {
    if (!seriesMap.has(rec.seriesId)) seriesMap.set(rec.seriesId, []);
    // Attach workId if possible
    let workId = null;
    if (rec.ao3ID) workId = String(rec.ao3ID);
    else if (rec.url && /works\/(\d+)/.test(rec.url)) workId = rec.url.match(/works\/(\d+)/)[1];
    seriesMap.get(rec.seriesId).push({ ...rec, workId });
  }

  // 3. For each Series, merge all series_works from its recs, dedupe by workId or url, and upsert into Series.series_works
  for (const [seriesId, recsForSeries] of seriesMap.entries()) {
    const series = await Series.findByPk(seriesId);
    if (!series) continue;
    // Collect all works from recs' series_works arrays
    let allWorks = [];
    for (const rec of recsForSeries) {
      if (Array.isArray(rec.series_works)) {
        allWorks.push(...rec.series_works);
      }
    }
    // Dedupe by url or title+authors
    const seen = new Set();
    const deduped = [];
    for (const work of allWorks) {
      const key = work.url || (work.title + '::' + (Array.isArray(work.authors) ? work.authors.join(',') : ''));
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(work);
      }
    }
    // Optionally, sort by workIds if available
    if (Array.isArray(series.workIds) && series.workIds.length > 0) {
      deduped.sort((a, b) => {
        const aId = a.url && a.url.match(/works\/(\d+)/) ? a.url.match(/works\/(\d+)/)[1] : null;
        const bId = b.url && b.url.match(/works\/(\d+)/) ? b.url.match(/works\/(\d+)/)[1] : null;
        return series.workIds.indexOf(aId) - series.workIds.indexOf(bId);
      });
    }
    // Reconstruct AO3 series URL from seriesId
    const ao3SeriesUrl = `https://archiveofourown.org/series/${seriesId}`;
    // Upsert into Series
    await series.update({ series_works: deduped, url: ao3SeriesUrl });
    console.log(`Updated Series ${series.id} (${series.name}) with ${deduped.length} works and url ${ao3SeriesUrl}.`);
  }
  console.log('Migration complete.');
}

migrateSeriesWorks().then(() => sequelize.close());