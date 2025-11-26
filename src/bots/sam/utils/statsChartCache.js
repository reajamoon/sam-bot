// Simple in-memory cache for stats chart files
// Keyed by userId or custom key, values are { files: [AttachmentBuilder, ...], expires: timestamp }

import fs from 'fs-extra';

const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
import logger from '../../../shared/utils/logger.js';

export function setStatsChartCache(key, files, ttl = DEFAULT_TTL) {
    // Extract file paths for cleanup
    const filePaths = files
        .map(f => (f && f.attachment) ? f.attachment : (f && f.path) ? f.path : null)
        .filter(Boolean);
    logger.info(`[setStatsChartCache] key=${key}, files=${JSON.stringify(files.map(f => f.name || f.path || f.attachment))}`);
    cache.set(key, {
        files,
        filePaths,
        expires: Date.now() + ttl
    });
}

export function getStatsChartCache(key) {
    const entry = cache.get(key);
    logger.info(`[getStatsChartCache] key=${key}, found=${!!entry}, files=${entry ? JSON.stringify(entry.files.map(f => f.name || f.path || f.attachment)) : 'null'}`);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return null;
    }
    return entry.files;
}

export function clearStatsChartCache(key) {
    cache.delete(key);
}
// Periodic cleanup of expired cache entries and their files
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.expires < now) {
            cache.delete(key);
        }
    }
}, CLEANUP_INTERVAL);
setInterval(async () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.expires < now) {
            // Attempt to delete all associated files
            if (Array.isArray(entry.filePaths)) {
                for (const filePath of entry.filePaths) {
                    try {
                        await fs.unlink(filePath);
                    } catch {}
                }
            }
            cache.delete(key);
        }
    }
}, CLEANUP_INTERVAL);
