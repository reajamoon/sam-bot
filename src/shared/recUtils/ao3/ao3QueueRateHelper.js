// ao3QueueRateHelper.js
// Utility for AO3 queue-aware rate limiting

export const MIN_INTERVAL_MS = parseInt(process.env.AO3_MIN_REQUEST_INTERVAL_MS, 10) || 12000;
let lastRequestTime = 0;

export function getNextAvailableAO3Time(numRequests = 1) {
    const now = Date.now();
    const earliest = lastRequestTime + MIN_INTERVAL_MS * numRequests;
    return Math.max(now, earliest);
}

export function markAO3Requests(numRequests = 1) {
    lastRequestTime = Math.max(Date.now(), lastRequestTime + MIN_INTERVAL_MS * numRequests);
}
