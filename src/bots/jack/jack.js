
import { Op } from 'sequelize';
import { ParseQueue, ParseQueueSubscriber, User, Recommendation, Config, Series, sequelize } from '../../models/index.js';
import processAO3Job from '../../shared/recUtils/processAO3Job.js';
import batchSeriesRecommendationJob from '../../shared/recUtils/batchSeriesRecommendationJob.js';
import processFicJob from '../../shared/recUtils/processFicJob.js';
import { detectSiteAndExtractIDs } from '../../shared/recUtils/processUserMetadata.js';
import dotenv from 'dotenv';
import { getNextAvailableAO3Time, markAO3Requests, MIN_INTERVAL_MS } from '../../shared/recUtils/ao3/ao3QueueRateHelper.js';
import updateMessages from '../../shared/text/updateMessages.js';
dotenv.config();
console.log('Node.js version:', process.version);

// Optimized: get mention string for subscribers using a user map
function getTagMentions(subscribers, userMap) {
	if (!subscribers.length) return '';
	return subscribers
		.filter(sub => userMap.has(sub.user_id) && userMap.get(sub.user_id).queueNotifyTag !== false)
		.map(sub => `<@${sub.user_id}>`).join(' ');
}

async function cleanupOldQueueJobs() {
	const now = new Date();
	// Remove 'done' and 'series-done' jobs older than 3 hours
	const doneCutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);
	const doneDeleted = await ParseQueue.destroy({ where: { status: ['done', 'series-done'], updated_at: { [Op.lt]: doneCutoff } } });
	if (doneDeleted > 0) {
		console.log(`[QueueWorker] Cleanup: Removed ${doneDeleted} completed jobs older than 3 hours.`);
	} else {
		console.log('[QueueWorker] Cleanup: No old completed jobs to remove.');
	}

	// Find 'pending' or 'processing' jobs older than 15 minutes
	const stuckCutoff = new Date(now.getTime() - 15 * 60 * 1000);
	const stuckJobs = await ParseQueue.findAll({ where: { status: ['pending', 'processing'], updated_at: { [Op.lt]: stuckCutoff } } });
	const errorJobs = await ParseQueue.findAll({ where: { status: 'error' } });
	const allJobs = [...stuckJobs, ...errorJobs];
	if (allJobs.length === 0) return;

	// Batch fetch all subscribers for these jobs
	const allJobIds = allJobs.map(j => j.id);
	const allSubscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: allJobIds } });
	if (stuckJobs.length > 0) {
		console.log(`[QueueWorker] Cleanup: Found ${stuckJobs.length} stuck 'pending' or 'processing' jobs older than 15 minutes.`);
	} else {
		console.log('[QueueWorker] Cleanup: No stuck pending/processing jobs to remove.');
	}
	for (const job of stuckJobs) {
		// Notify all subscribers (respect queueNotifyTag)
		const subscribers = await ParseQueueSubscriber.findAll({ where: { queue_id: job.id } });
		const configEntry = await Config.findOne({ where: { key: 'fic_queue_channel' } });
		if (configEntry && subscribers.length > 0) {
			// No direct Discord interaction for Jack; notification logic should be handled by Sam.
			// Optionally, write a notification row or update a status for Sam to pick up.
		}
		await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
		await job.destroy();
		console.log(`[QueueWorker] Cleanup: Dropped stuck job id=${job.id} (status: ${job.status}, url: ${job.fic_url})`);
	}

	// Notify and clean up for each job
	for (const job of allJobs) {
		const subscribers = allSubscribers.filter(sub => sub.queue_id === job.id);
		// No direct Discord interaction for Jack; notification logic should be handled by Sam.
	}
	// Bulk destroy all subscribers and jobs
	await ParseQueueSubscriber.destroy({ where: { queue_id: allJobIds } });
	await ParseQueue.destroy({ where: { id: allJobIds } });
}

// Estimate AO3 requests for a job (can be improved for series, etc.)
function estimateAO3Requests(job) {
	// For AO3 series, estimate 1 + N works; for single fic, 1
	if (/archiveofourown\.org\/series\//.test(job.fic_url) && job.result && Array.isArray(job.result.series_works)) {
		return 1 + job.result.series_works.length;
	}
	return 1;
}

async function processQueueJob(job) {
	try {
		await job.update({ status: 'processing' });
		// Use the original requester's user context for the rec
		// Try to get the username from the first subscriber, fallback to 'Unknown User'
		let user = { id: job.requested_by || 'queue', username: 'Unknown User' };
		const firstSub = await ParseQueueSubscriber.findOne({ where: { queue_id: job.id }, order: [['created_at', 'ASC']] });
		let userMap = new Map();
		if (firstSub) {
			const userRecord = await User.findOne({ where: { discordId: firstSub.user_id } });
			user = {
				id: firstSub.user_id,
				username: userRecord ? userRecord.username : `User ${firstSub.user_id}`
			};
			if (userRecord) userMap.set(userRecord.discordId, userRecord);
		}

		const startTime = Date.now();
		
		// NEW ARCHITECTURE: URL-only processing 
		// User metadata (notes, manual fields) is handled by Sam command handlers upfront
		// Jack only processes URLs and fetches AO3/site metadata
		const siteInfo = detectSiteAndExtractIDs(job.fic_url);
		
		let result;
		if (siteInfo.site !== 'ao3') {
			// Route to general fanfiction processor
			result = await processFicJob({
				url: job.fic_url,
				user,
				isUpdate: false, // Queue doesn't track updates for non-AO3
				site: siteInfo.site
			});
		} else if (siteInfo.isSeriesUrl) {
			// Series URL: Route to batch series processor
			const existingSeries = await Series.findOne({ where: { url: job.fic_url } });
			const isUpdate = !!existingSeries;
			
			result = await batchSeriesRecommendationJob({
				url: job.fic_url,
				user,
				isUpdate
			});
		} else if (siteInfo.isWorkUrl) {
			// Work URL: Route to single work processor
			const existingRec = await Recommendation.findOne({ where: { ao3ID: siteInfo.ao3ID } });
			const isUpdate = !!existingRec;
			
			result = await processAO3Job({
				ao3ID: siteInfo.ao3ID,
				user,
				isUpdate,
				type: 'work'
			});
		} else {
			throw new Error('Invalid URL format');
		}

		// Handle processing result
		await handleJobResult(job, result, siteInfo);
		
	} catch (error) {
		console.error('[QueueWorker] Job processing failed:', error);
		await job.update({ status: 'error', error_message: error.message || 'Processing failed' });
		await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
	}
}
async function handleJobResult(job, result, siteInfo) {
	try {
		// Handle error cases
		if (result.error) {
			if (result.error.toLowerCase().includes('dean/cas') || result.error.toLowerCase().includes('validation')) {
				await job.update({
					status: 'nOTP',
					validation_reason: result.error,
					error_message: null,
					result: null
				});
			} else {
				await job.update({ status: 'error', error_message: result.error });
			}
			await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
			return;
		}

		// Handle successful processing
		let resultPayload;
		let finalStatus = 'done'; // Default status for regular jobs
		
		if (siteInfo.isSeriesUrl) {
			// Series result
			resultPayload = {
				id: result.processedWorks?.[0]?.recommendation?.id || null,
				type: 'series',
				seriesId: result.seriesId,
				workCount: result.totalWorks || 0
			};
			// Series batch jobs use series-done status
			if (job.batch_type === 'series') {
				finalStatus = 'series-done';
			}
		} else {
			// Work result
			resultPayload = {
				id: result.recommendation?.id || null,
				type: 'work'
			};
		}

		await job.update({ 
			status: finalStatus, 
			result: resultPayload, 
			error_message: null, 
			validation_reason: null 
		});

		// Suppress notification if instant_candidate and within threshold
		let thresholdMs = 3000; // default 3 seconds
		const thresholdConfig = await Config.findOne({ where: { key: 'instant_queue_suppress_threshold_ms' } });
		if (thresholdConfig && !isNaN(Number(thresholdConfig.value))) {
			thresholdMs = Number(thresholdConfig.value);
		}
		const elapsed = Date.now() - new Date(job.submitted_at).getTime();
		if (job.instant_candidate && elapsed < thresholdMs) {
			// Clean up subscribers silently
			await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
			return;
		}

		// Clean up subscribers after notification
		await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });

	} catch (error) {
		console.error('[QueueWorker] Error handling job result:', error);
		await job.update({ status: 'error', error_message: error.message || 'Result handling failed' });
		await ParseQueueSubscriber.destroy({ where: { queue_id: job.id } });
	}
}

async function pollQueue() {
	while (true) {
		try {
			await sequelize.sync();
			const job = await ParseQueue.findOne({ where: { status: 'pending' }, order: [['created_at', 'ASC']] });
			if (job) {
				// AO3 rate-aware queue: estimate requests and wait for next available slot
				const numRequests = estimateAO3Requests(job);
				const nextAvailable = getNextAvailableAO3Time(numRequests);
				const now = Date.now();
				if (nextAvailable > now) {
					const wait = nextAvailable - now;
					console.log(`[QueueWorker] AO3 rate limit: waiting ${wait}ms before processing job ${job.id}`);
					await new Promise(res => setTimeout(res, wait));
				}
				// Simulate 'think time' before starting each job (0.5–2s)
				const thinkTime = 500 + Math.floor(Math.random() * 1500);
				console.log(`[QueueWorker] Waiting think time: ${thinkTime}ms before processing job ${job.id}`);
				await new Promise(res => setTimeout(res, thinkTime));

				console.log(`[QueueWorker] Starting job ${job.id} at ${new Date().toISOString()}`);
				await processQueueJob(job);
				// Mark AO3 slot as used for this job
				markAO3Requests(numRequests);
				console.log(`[QueueWorker] Finished job ${job.id} at ${new Date().toISOString()}`);

				// Vary delay range (12–20s normal, 20–30s rare)
				// Use a weighted random: 75% chance 12–20s, 25% chance 20–30s
				let delayMs;
				const r = Math.random();
				if (r < 0.75) {
					delayMs = 12000 + Math.floor(Math.random() * 8000); // 12–20s
				} else {
					delayMs = 20000 + Math.floor(Math.random() * 10000); // 20–30s
				}

				// Rare long pause: every 10–20 jobs, pause 1–3 min
				pollQueue.jobCount = (pollQueue.jobCount || 0) + 1;
				const jobsPerPause = 10 + Math.floor(Math.random() * 11);
				if (pollQueue.jobCount % jobsPerPause === 0) {
					const longPause = 60000 + Math.floor(Math.random() * 120000); // 1–3 min
					console.log(`[QueueWorker] Taking a long pause for ${Math.round(longPause/1000)} seconds after job ${job.id} (jobCount: ${pollQueue.jobCount}, jobsPerPause: ${jobsPerPause})`);
					await new Promise(res => setTimeout(res, longPause));
					console.log(`[QueueWorker] Finished long pause after job ${job.id} at ${new Date().toISOString()}`);
				} else {
					console.log(`[QueueWorker] Waiting delay: ${delayMs}ms after job ${job.id}`);
					await new Promise(res => setTimeout(res, delayMs));
					console.log(`[QueueWorker] Finished delay after job ${job.id} at ${new Date().toISOString()}`);
				}
			} else {
				// No pending jobs, wait before polling again (randomize 4–7s)
				const idleDelay = 4000 + Math.floor(Math.random() * 3000);
				console.log(`[QueueWorker] No pending jobs. Waiting idle delay: ${idleDelay}ms`);
				await new Promise(res => setTimeout(res, idleDelay));
				console.log(`[QueueWorker] Finished idle delay at ${new Date().toISOString()}`);
			}
		} catch (err) {
			console.error('[QueueWorker] Polling error:', err);
			await new Promise(res => setTimeout(res, 10000));
		}
	}
}

// Jack does not interact with Discord directly, so no Discord.js client is started here.

// Start polling the queue and run cleanup on interval
pollQueue();
setInterval(() => {
	console.log('[QueueWorker] Running scheduled cleanup of old queue jobs...');
	cleanupOldQueueJobs();
}, 15 * 60 * 1000);
// Also run once at startup
console.log('[QueueWorker] Running initial cleanup of old queue jobs...');
cleanupOldQueueJobs();
