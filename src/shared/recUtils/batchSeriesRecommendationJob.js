// batchSeriesRecommendationJob.js
// Complete series processing flow for AO3 series

import { Series, Recommendation } from '../../models/index.js';
import processAO3Job from './processAO3Job.js';

/**
 * Complete series processing that handles both Series table and Recommendation records
 * @param {Object} payload
 * @param {string} payload.url - Series URL (e.g., https://archiveofourown.org/series/12345)
 * @param {Object} payload.user - User context
 * @param {boolean} [payload.isUpdate] - Whether this is an update
 */
async function batchSeriesRecommendationJob(payload) {
  const { url, user, isUpdate = false } = payload;
  
  try {
    // Step 1: Parse series page to get series metadata + works list
    const { fetchAO3SeriesMetadata } = await import('../../shared/recUtils/ao3Meta.js');
    const seriesMetadata = await fetchAO3SeriesMetadata(url);
    
    if (!seriesMetadata || !seriesMetadata.works || seriesMetadata.works.length === 0) {
      return { error: 'Could not parse series or no works found' };
    }
    
    // Step 2: Create/update Series record in database
    const seriesRecord = await upsertSeriesRecord(seriesMetadata, url);
    
    if (!seriesRecord || !seriesRecord.id) {
      return { error: 'Failed to create/update series record' };
    }
    
    // Step 3: Process individual works (limit to 5)
    const worksToProcess = seriesMetadata.works.slice(0, 5);
    const results = [];
    
    for (let i = 0; i < worksToProcess.length; i++) {
      const work = worksToProcess[i];
      const ao3ID = extractAO3WorkId(work.url);
      
      if (!ao3ID) {
        console.warn('[batchSeriesJob] Could not extract ao3ID from work URL:', work.url);
        continue;
      }
      
      // Determine if this is the primary work (first in series)
      const isNotPrimary = i > 0;
      
      // Process individual work
      const workResult = await processAO3Job({
        ao3ID,
        seriesId: seriesRecord.ao3SeriesId, // Use AO3 series ID, not database ID
        user,
        isUpdate,
        type: 'work',
        notPrimaryWork: isNotPrimary
      });
      
      if (workResult.error) {
        console.error(`[batchSeriesJob] Error processing work ${ao3ID}:`, workResult.error);
      } else {
        results.push(workResult);
      }
    }
    
    // Step 4: Return result with series info and processed works
    // Return the primary work's ID for queue notifications
    const primaryWorkResult = results.find(r => r.recommendation) || results[0];
    const primaryRecId = primaryWorkResult?.recommendation?.id || null;
    
    return {
      type: 'series',
      id: primaryRecId, // ID of primary recommendation for queue notifications
      seriesId: seriesRecord.id, // Database series ID
      seriesRecord,
      processedWorks: results,
      totalWorks: worksToProcess.length,
      // Could return embed for primary work or series summary
      embed: results[0]?.embed || null
    };
    
  } catch (err) {
    console.error('[batchSeriesJob] Error processing series:', err);
    return { error: 'Series processing failed' };
  }
}

/**
 * Creates or updates Series record from AO3 series metadata
 */
async function upsertSeriesRecord(seriesMetadata, url) {
  try {
    const seriesData = {
      name: seriesMetadata.seriesTitle || seriesMetadata.title || 'Untitled Series',
      url: url,
      summary: seriesMetadata.seriesSummary || seriesMetadata.summary || '',
      ao3SeriesId: extractAO3SeriesId(url),
      authors: seriesMetadata.authors || [],
      workCount: seriesMetadata.workCount || seriesMetadata.works?.length || 0,
      wordCount: seriesMetadata.wordCount || null,
      status: seriesMetadata.status || 'Unknown',
      // Store work IDs for reference
      workIds: seriesMetadata.works?.map(w => extractAO3WorkId(w.url)).filter(Boolean) || [],
      // Store work metadata for display
      series_works: seriesMetadata.works?.map(w => ({
        title: w.title,
        url: w.url,
        authors: w.authors,
        summary: w.summary
      })) || []
    };
    
    // Upsert series record (update if exists, create if not)
    const [seriesRecord, created] = await Series.upsert(seriesData, {
      returning: true,
      conflictFields: ['url'] // Use URL as unique identifier
    });
    
    console.log(`[upsertSeriesRecord] ${created ? 'Created' : 'Updated'} series:`, {
      id: seriesRecord.id,
      name: seriesRecord.name,
      workCount: seriesRecord.workCount
    });
    
    return seriesRecord;
    
  } catch (err) {
    console.error('[upsertSeriesRecord] Error upserting series:', err);
    throw err;
  }
}

/**
 * Extract AO3 work ID from work URL
 */
function extractAO3WorkId(url) {
  const match = url && url.match(/\/works\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract AO3 series ID from series URL
 */
function extractAO3SeriesId(url) {
  const match = url && url.match(/\/series\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default batchSeriesRecommendationJob;