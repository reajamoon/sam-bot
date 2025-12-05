// batchSeriesRecommendationJob.js
// Complete series processing flow for AO3 series

import { Series, Recommendation } from '../../models/index.js';
import processAO3Job from './processAO3Job.js';
import { isFieldGloballyModlocked, shouldBotsRespectGlobalModlocks } from '../utils/globalModlockUtils.js';
import { markPrimaryAndNotPrimaryWorks } from '../../bots/sam/commands/recHandlers/seriesUtils.js';

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
    const seriesRecord = await upsertSeriesRecord(seriesMetadata, url, user);

    if (!seriesRecord || !seriesRecord.id) {
      return { error: 'Failed to create/update series record' };
    }

    // Step 3: Process individual works (limit to 5)
    const worksToProcess = seriesMetadata.works.slice(0, 5);

    // Build AO3 order -> part number map using the full series list
    const ao3PartMap = new Map(); // ao3ID -> part (1-based index in AO3 list)
    if (Array.isArray(seriesMetadata.works)) {
      for (let i = 0; i < seriesMetadata.works.length; i++) {
        const w = seriesMetadata.works[i];
        const ao3Id = extractAO3WorkId(w.url);
        if (ao3Id) ao3PartMap.set(ao3Id, i + 1);
      }
    }

    // Step 3a: Determine which works are primary vs not primary using proper logic
    const markedWorks = markPrimaryAndNotPrimaryWorks(worksToProcess);
    const results = [];
    let validationFailed = false;
    let validationReason = null;
    const failures = [];

    for (let i = 0; i < markedWorks.length; i++) {
      const markedWork = markedWorks[i];
      const work = markedWork.work;
      const ao3ID = extractAO3WorkId(work.url);

      if (!ao3ID) {
        console.warn('[batchSeriesJob] Could not extract ao3ID from work URL:', work.url);
        continue;
      }

      // Check if this work already exists to determine if we should update
      const { Recommendation } = await import('../../models/index.js');
      const existingWork = await Recommendation.findOne({ where: { ao3ID } });
      const shouldUpdate = !!existingWork;

      // Use the proper notPrimaryWork flag from the analysis
      const isNotPrimary = markedWork.notPrimaryWork;

      // Process individual work
      const workResult = await processAO3Job({
        ao3ID,
        seriesId: seriesRecord.ao3SeriesId, // Use AO3 series ID, not database ID
        user,
        isUpdate: shouldUpdate,
        type: 'work',
        notPrimaryWork: isNotPrimary,
        part: ao3PartMap.get(ao3ID) || null
      });

      if (workResult.error) {
        console.error(`[batchSeriesJob] Error processing work ${ao3ID}:`, workResult.error);
        if ((workResult.error || '').toLowerCase() === 'validation_failed') {
          validationFailed = true;
          validationReason = workResult.error_message || workResult.error;
          failures.push({ url: work.url, reason: validationReason });
        }
      } else {
        results.push(workResult);
      }
    }

    // Step 4: Return result with series info and processed works
    // Find the primary work's result for queue notifications
    // The primary work corresponds to the work that was marked as NOT notPrimaryWork
    let primaryWorkResult = null;
    for (let i = 0; i < results.length && i < markedWorks.length; i++) {
      if (!markedWorks[i].notPrimaryWork && results[i] && results[i].recommendation) {
        primaryWorkResult = results[i];
        break;
      }
    }
    // Fallback to first successful result if no primary work found
    if (!primaryWorkResult) {
      primaryWorkResult = results.find(r => r.recommendation) || results[0];
    }
    const primaryRecId = primaryWorkResult?.recommendation?.id || null;

    if (validationFailed) {
      return { error: 'validation_failed', error_message: validationReason, failures };
    }
    return {
      type: 'series',
      id: primaryRecId, // ID of primary recommendation for queue notifications
      seriesId: seriesRecord.id, // Database series ID
      seriesRecord,
      processedWorks: results,
      totalWorks: worksToProcess.length
    };

  } catch (err) {
    console.error('[batchSeriesJob] Error processing series:', err);
    return { error: 'Series processing failed' };
  }
}

/**
 * Creates or updates Series record from AO3 series metadata
 */
async function upsertSeriesRecord(seriesMetadata, url, user) {
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
      recommendedBy: user && user.id ? user.id : null,
      recommendedByUsername: user && user.username ? user.username : null,
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
    // For global locks: allow AO3 to fill unset fields, but do not overwrite set fields
    const isUnset = (val) => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string') return val.trim().length === 0;
      if (Array.isArray(val)) return val.length === 0;
      return false;
    };

    // Find existing by URL; if exists, update only unlocked fields
    let seriesRecord = await Series.findOne({ where: { url } });
    let created = false;
    if (!seriesRecord) {
      seriesRecord = await Series.create(seriesData);
      created = true;
    } else {
      const updatePayload = {};
      const candidateFields = ['name','summary','authors','workCount','wordCount','status','workIds','series_works'];
      for (const field of candidateFields) {
        const botsRespect = await shouldBotsRespectGlobalModlocks();
        const locked = botsRespect ? await isFieldGloballyModlocked(field) : false;
        const lockedAndSet = locked && !isUnset(seriesRecord[field]);
        if (!lockedAndSet) updatePayload[field] = seriesData[field];
      }
      // Set recommender only if not already persisted
      if (!seriesRecord.recommendedBy && user && user.id) {
        updatePayload.recommendedBy = user.id;
        updatePayload.recommendedByUsername = user.username || null;
      }
      if (Object.keys(updatePayload).length > 0) {
        await seriesRecord.update(updatePayload);
        await seriesRecord.reload();
      }
    }

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