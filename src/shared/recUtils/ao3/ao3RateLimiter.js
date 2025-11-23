// ao3RateLimiter.js
// Simple global rate limiter for AO3 requests (singleton)
const MIN_INTERVAL_MS = parseInt(process.env.AO3_MIN_REQUEST_INTERVAL_MS, 10) || 4000; // 4 seconds default
let lastRequestTime = 0;
let queue = Promise.resolve();
async function ao3RateLimit() {
    // Chain requests to ensure serial execution
    queue = queue.then(async () => {
        const now = Date.now();
        const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
        if (wait > 0) {
            await new Promise(res => setTimeout(res, wait));
        }
        lastRequestTime = Date.now();
    });
    return queue;
}

module.exports = { ao3RateLimit };
