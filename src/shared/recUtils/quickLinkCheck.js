/**
 * Quick check if a URL is accessible (HEAD request)
 * @param {string} url
 * @returns {Promise<boolean>}
 */
const https = require('https');
const http = require('http');

async function quickLinkCheck(url) {
    return new Promise((resolve) => {
        try {
            const client = url.startsWith('https:') ? https : http;
            const options = {
                method: 'HEAD',
                timeout: 3000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            const req = client.request(url, options, (res) => {
                if (res.statusCode < 400) {
                    resolve(true);
                } else if ((url.includes('tumblr.com') || url.includes('.tumblr.com'))) {
                    // Fallback to GET for Tumblr
                    const getOptions = { ...options, method: 'GET' };
                    const getReq = client.request(url, getOptions, (getRes) => {
                        resolve(getRes.statusCode < 400);
                    });
                    getReq.on('error', () => resolve(false));
                    getReq.on('timeout', () => {
                        getReq.destroy();
                        resolve(false);
                    });
                    getReq.end();
                } else {
                    resolve(false);
                }
            });

            req.on('error', () => {
                if ((url.includes('tumblr.com') || url.includes('.tumblr.com'))) {
                    // Fallback to GET for Tumblr
                    const getOptions = { ...options, method: 'GET' };
                    const getReq = client.request(url, getOptions, (getRes) => {
                        resolve(getRes.statusCode < 400);
                    });
                    getReq.on('error', () => resolve(false));
                    getReq.on('timeout', () => {
                        getReq.destroy();
                        resolve(false);
                    });
                    getReq.end();
                } else {
                    resolve(false);
                }
            });
            req.on('timeout', () => {
                req.destroy();
                if ((url.includes('tumblr.com') || url.includes('.tumblr.com'))) {
                    // Fallback to GET for Tumblr
                    const getOptions = { ...options, method: 'GET' };
                    const getReq = client.request(url, getOptions, (getRes) => {
                        resolve(getRes.statusCode < 400);
                    });
                    getReq.on('error', () => resolve(false));
                    getReq.on('timeout', () => {
                        getReq.destroy();
                        resolve(false);
                    });
                    getReq.end();
                } else {
                    resolve(false);
                }
            });

            req.end();
        } catch (error) {
            resolve(false);
        }
    });
}

module.exports = quickLinkCheck;
