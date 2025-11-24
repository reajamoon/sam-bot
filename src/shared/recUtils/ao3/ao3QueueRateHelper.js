// ao3QueueRateHelper.js
// Utility for AO3 queue-aware rate limiting

const MIN_INTERVAL_MS = parseInt(process.env.AO3_MIN_REQUEST_INTERVAL_MS, 10) || 6000;
let lastRequestTime = 0;

function getNextAvailableAO3Time(numRequests = 1) {
    const now = Date.now();
    const earliest = lastRequestTime + MIN_INTERVAL_MS * numRequests;
    return Math.max(now, earliest);
}

function markAO3Requests(numRequests = 1) {
    lastRequestTime = Math.max(Date.now(), lastRequestTime + MIN_INTERVAL_MS * numRequests);
}

module.exports = { getNextAvailableAO3Time, markAO3Requests, MIN_INTERVAL_MS };
