
// All requires and constants at the very top to avoid ReferenceError and circular dependency issues
const fs = require('fs');
const COOKIES_PATH = 'ao3_cookies.json';
const { getSharedBrowser, logBrowserEvent, getCurrentUserAgent } = require('./ao3BrowserManager');

/**
 * Utility to bypass AO3 'stay logged in' interstitial by re-navigating to the target fic URL.
 * Call this after login if you detect the interstitial.
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} ficUrl - The AO3 work URL to re-navigate to
 */
async function bypassStayLoggedInInterstitial(page, ficUrl) {
    // Check for the interstitial by looking for the message or button
    const content = await page.content();
    if (content.includes("you'll stay logged in for two weeks") || content.includes('stay logged in')) {
        // Re-navigate to the fic URL
        await page.goto(ficUrl, { waitUntil: 'domcontentloaded' });
        return true;
    }
    return false;
}
/**
 * Debug utility: Logs in to AO3, navigates to a work URL, logs debug info, and pauses for inspection.
 * @param {string} workUrl - AO3 work URL to fetch after login
 */
async function debugLoginAndFetchWork(workUrl) {
    const { browser, page } = await getLoggedInAO3Page();
    try {
        if (!workUrl) {
            return;
        }
        await page.goto(workUrl, { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        const url = page.url();
        const content = await page.content();
        if (page.browser().process() && page.browser().process().spawnargs.includes('--headless=false')) {
            await new Promise(resolve => {
                process.stdin.resume();
                process.stdin.once('data', () => {
                    process.stdin.pause();
                    resolve();
                });
            });
        }
    } finally {
        await browser.close();
    }
}



/**
 * Logs in to AO3 and returns a logged-in Puppeteer page.
 * @returns {Promise<{ browser: import('puppeteer').Browser, page: import('puppeteer').Page }>}
 */
async function getLoggedInAO3Page() {
    // Helper: check if page is 'New Session' interstitial by title
    async function isNewSessionTitle(page) {
        const title = await page.title();
        return title && title.trim().startsWith('New') && title.includes('Session');
    }
    const AO3_LOGIN_URL = 'https://archiveofourown.org/users/login';
    const username = process.env.AO3_USERNAME;
    const password = process.env.AO3_PASSWORD;
    const headless = process.env.AO3_HEADLESS === 'false' ? false : true;
    // fs and COOKIES_PATH already declared above
    // Configurable timeouts (ms)
    const NAV_TIMEOUT = parseInt(process.env.AO3_NAV_TIMEOUT, 10) || 90000;
    const LOGIN_RETRY_MAX = parseInt(process.env.AO3_LOGIN_RETRY_MAX, 10) || 3;
    const LOGIN_RETRY_BASE_DELAY = parseInt(process.env.AO3_LOGIN_RETRY_BASE_DELAY, 10) || 5000;
    if (!username || !password) {
        throw new Error('AO3_USERNAME or AO3_PASSWORD is missing from environment.');
    }
    let browser;
    try {
        browser = await getSharedBrowser();
    } catch (err) {
        logBrowserEvent('Failed to get shared browser: ' + err.message);
        throw err;
    }
    let page;
    try {
        // Limit open pages to prevent leaks
        let openPages = await browser.pages();
        if (openPages.length > 4) {
            logBrowserEvent(`[AO3] Too many open pages (${openPages.length}). Closing extras.`);
            for (let i = 1; i < openPages.length; i++) {
                try { await openPages[i].close(); } catch (e) { logBrowserEvent('Error closing extra page: ' + e.message); }
            }
            // After closing, re-fetch open pages to ensure browser state is stable
            openPages = await browser.pages();
        }
        page = await browser.newPage();
        // Defensive: check if page is not detached before proceeding
        if (page.isClosed() || !page.mainFrame() || page.mainFrame()._detached) {
            logBrowserEvent('New page is already closed or detached after creation. Retrying...');
            page = await browser.newPage();
        }
    } catch (err) {
        logBrowserEvent('Error creating new page: ' + err.message);
        // If browser is disconnected, force restart on next use
        if (err.message && (err.message.includes('Target closed') || err.message.includes('browser has disconnected'))) {
            logBrowserEvent('Detected browser/page error, will restart browser.');
            try { await browser.close(); logBrowserEvent('Browser closed after page error.'); } catch {}
            sharedBrowser = null;
            sharedBrowserUseCount = 0;
        }
        throw err;
    }
    // Use the current browser session's user-agent for all pages
    await page.setUserAgent(getCurrentUserAgent());
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1',
        'X-Sam-Bot-Info': 'Hi AO3 devs! This is Sam, a hand-coded Discord bot for a single small server. I only fetch header metadata for user recs and do not retrieve fic content. Contact: https://github.com/reajamoon/sam-bot'
    });

    if (fs.existsSync(COOKIES_PATH)) {
        try {
            logBrowserEvent('[AO3] Attempting to load cookies from file...');
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
            await page.goto('https://archiveofourown.org/', { waitUntil: 'domcontentloaded' });
            await page.setCookie(...cookies);
            await page.reload({ waitUntil: 'domcontentloaded' });
            const content = await page.content();
            if (content.includes('Log Out') || content.includes('My Dashboard')) {
                logBrowserEvent('[AO3] Successfully logged in with cookies. No fresh login needed.');
                return { browser, page, loggedInWithCookies: true };
            } else {
                // Not logged in, cookies are bad/expired
                logBrowserEvent('[AO3] Cookies invalid or expired. Deleting cookies and forcing fresh login.');
                fs.unlinkSync(COOKIES_PATH);
                // Reset in-memory cookies if used
                if (global.__samInMemoryCookies) {
                    global.__samInMemoryCookies = null;
                    logBrowserEvent('[AO3] In-memory cookies reset due to invalid file cookies.');
                }
            }
        } catch (err) {
            logBrowserEvent('[AO3] Failed to load cookies, will attempt fresh login. ' + (err && err.message ? err.message : ''));
            try { fs.unlinkSync(COOKIES_PATH); } catch {}
            if (global.__samInMemoryCookies) {
                global.__samInMemoryCookies = null;
                logBrowserEvent('[AO3] In-memory cookies reset due to cookie load failure.');
            }
        }
    }
    logBrowserEvent('[AO3] Performing fresh login (no valid cookies found).');
    // Go to login page
    console.log('[AO3] Navigating to login page...');
    // Try navigating to login page with exponential backoff and multiple retries
    const gotoLogin = async () => {
        let attempt = 0;
        let lastErr = null;
        while (attempt < LOGIN_RETRY_MAX) {
            try {
                // Defensive: check if page is still open and not detached before navigation
                if (page.isClosed() || !page.mainFrame() || page.mainFrame()._detached) {
                    logBrowserEvent('Page is closed or detached before navigation, recreating page...');
                    page = await browser.newPage();
                    await page.setUserAgent(getCurrentUserAgent());
                    await page.setExtraHTTPHeaders({
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Upgrade-Insecure-Requests': '1',
                        'X-Sam-Bot-Info': 'Hi AO3 devs! This is Sam, a hand-coded Discord bot for a single small server. I only fetch header metadata for user recs and do not retrieve fic content. Contact: https://github.com/reajamoon/sam-bot'
                    });
                }
                await page.goto(AO3_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
                return;
            } catch (err) {
                lastErr = err;
                // Handle detached frame errors specifically
                if ((err.message && (err.message.includes('detached') || err.message.includes('LifecycleWatcher disposed'))) || (err.name === 'Error' && err.message && err.message.includes('Frame'))) {
                    logBrowserEvent('Frame was detached during navigation, recreating page and retrying...');
                    if (!page.isClosed()) { try { await page.close(); } catch {} }
                    page = await browser.newPage();
                    await page.setUserAgent(getCurrentUserAgent());
                    await page.setExtraHTTPHeaders({
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Upgrade-Insecure-Requests': '1',
                        'X-Sam-Bot-Info': 'Hi AO3 devs! This is Sam, a hand-coded Discord bot for a single small server. I only fetch header metadata for user recs and do not retrieve fic content. Contact: https://github.com/reajamoon/sam-bot'
                    });
                } else if (err.name === 'TimeoutError' || (err.message && err.message.includes('timeout'))) {
                    const delay = LOGIN_RETRY_BASE_DELAY * Math.pow(2, attempt); // exponential backoff
                    console.warn(`[AO3] Login page navigation timed out (attempt ${attempt + 1}/${LOGIN_RETRY_MAX}), retrying after ${Math.round(delay/1000)}s...`);
                    await new Promise(res => setTimeout(res, delay));
                } else {
                    throw err;
                }
            }
            attempt++;
        }
        throw lastErr || new Error('AO3 login navigation failed after retries');
    };
    await gotoLogin();
    let loginError = null;
    try {
        // AO3-specific: detect rate-limiting or CAPTCHA/anti-bot pages (title and error containers only)
        const pageTitle = await page.title();
        const errorText = await page.evaluate(() => {
            // Check for AO3 error/notice/captcha containers
            const selectors = ['.error', '.notice', 'h1', 'h2', '#main .wrapper h1', '#main .wrapper h2'];
            let found = '';
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent) found += el.textContent + '\n';
            }
            return found;
        });
        const rateLimitMatch =
            (pageTitle && /rate limit|too many requests|prove you are human|unusual traffic|captcha/i.test(pageTitle)) ||
            (errorText && /rate limit|too many requests|prove you are human|unusual traffic|captcha/i.test(errorText));
        if (rateLimitMatch) {
            logBrowserEvent('[AO3] Rate limit or CAPTCHA detected during login (title or error container).');
            throw new Error('AO3 rate limit or CAPTCHA detected. Please wait and try again later.');
        }
        // detect 'New Session' title in <head>
        if (await isNewSessionTitle(page)) {
            // Retry navigation to login page if 'New Session' interstitial
            await gotoLogin();
            pageContent = await page.content();
        }
        // Try main login form first
        let mainLoginExists = false;
        try {
            await page.waitForSelector('#user_login', { timeout: 2000 });
            mainLoginExists = true;
        } catch {}
        if (mainLoginExists) {
            await page.type('#user_login', username);
            await page.type('#user_password', password);
            await Promise.all([
                page.click('#loginform input[name="commit"]'),
                page.waitForNavigation({ waitUntil: 'domcontentloaded' })
            ]);
        } else {
            // Fallback to small login form in header
            let smallLoginExists = false;
            try {
                await page.waitForSelector('#user_session_login_small', { timeout: 2000 });
                smallLoginExists = true;
            } catch {}
            if (smallLoginExists) {
                await page.type('#user_session_login_small', username);
                await page.type('#user_session_password_small', password);
                await Promise.all([
                    page.click('#small_login input[name="commit"]'),
                    page.waitForNavigation({ waitUntil: 'domcontentloaded' })
                ]);
            } else {
                // As a last resort, try clicking a generic button (interstitial)
                const button = await page.$('input[type="submit"], button');
                if (button) {
                    await Promise.all([
                        button.click(),
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 })
                    ]);
                }
            }
        }
        // After login, check for error messages and AO3-specific blocks (title and error containers only)
        const postLoginTitle = await page.title();
        const postLoginErrorText = await page.evaluate(() => {
            const selectors = ['.error', '.notice', 'h1', 'h2', '#main .wrapper h1', '#main .wrapper h2'];
            let found = '';
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent) found += el.textContent + '\n';
            }
            return found;
        });
        const postLoginRateLimitMatch =
            (postLoginTitle && /rate limit|too many requests|prove you are human|unusual traffic|captcha/i.test(postLoginTitle)) ||
            (postLoginErrorText && /rate limit|too many requests|prove you are human|unusual traffic|captcha/i.test(postLoginErrorText));
        if (postLoginRateLimitMatch) {
            logBrowserEvent('[AO3] Rate limit or CAPTCHA detected after login (title or error container).');
            throw new Error('AO3 rate limit or CAPTCHA detected. Please wait and try again later.');
        }
        if (!(postLoginErrorText.includes('Incorrect username or password') || postLoginErrorText.includes('error'))) {
            // Save cookies after successful login (atomic write)
            const cookies = await page.cookies();
            const path = require('path');
            const absPath = path.resolve(COOKIES_PATH);
            const tmpPath = absPath + '.tmp';
            let cookiesInMemory = null;
            try {
                fs.writeFileSync(tmpPath, JSON.stringify(cookies, null, 2));
                fs.renameSync(tmpPath, absPath);
                console.log(`[AO3] Login successful, cookies saved atomically at: ${absPath}`);
            } catch (err) {
                console.error(`[AO3] ERROR: Failed to atomically save cookies to ${absPath}:`, err);
                cookiesInMemory = cookies;
                // Optionally, you could notify an admin or set a global flag here
                console.warn('[AO3] WARNING: Cookies will be kept in memory for this session only. They will not persist after restart.');
            }
            // Attach in-memory cookies to the page/browser for fallback use
            if (cookiesInMemory) {
                // Attach to page for this session (if needed elsewhere, export or store globally)
                page.__samInMemoryCookies = cookiesInMemory;
            }
        }
    } catch (err) {
        loginError = err;
        console.error('[AO3] Login failed.', err);
        // On any login failure, always delete cookies and reset in-memory cookies
        try {
            if (fs.existsSync(COOKIES_PATH)) {
                fs.unlinkSync(COOKIES_PATH);
                logBrowserEvent('[AO3] Deleted cookies file due to login failure.');
            }
        } catch (e) {
            logBrowserEvent('[AO3] Failed to delete cookies file after login failure: ' + e.message);
        }
        if (global.__samInMemoryCookies) {
            global.__samInMemoryCookies = null;
            logBrowserEvent('[AO3] In-memory cookies reset after login failure.');
        }
        throw new Error('AO3 login failed.' + (err && err.message ? ' ' + err.message : ''));
    } finally {
        // Always close the page after login attempt to prevent leaks
        if (page && !page.isClosed()) {
            try { await page.close(); logBrowserEvent('[AO3] Closed page after login attempt.'); } catch (e) { logBrowserEvent('Error closing page after login attempt: ' + e.message); }
        }
    }
    // Open a new page for the caller to use
    page = await browser.newPage();
    // Always set the user agent and headers on the returned page to ensure session/cookie consistency
    await page.setUserAgent(getCurrentUserAgent());
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1',
        'X-Sam-Bot-Info': 'Hi AO3 devs! This is Sam, a hand-coded Discord bot for a single small server. I only fetch header metadata for user recs and do not retrieve fic content. Contact: https://github.com/reajamoon/sam-bot'
    });
    // Set cookies on the new page if cookies exist (fixes first-fic unauthenticated bug)
    const fs = require('fs');
    const COOKIES_PATH = 'ao3_cookies.json';
    let cookiesToSet = null;
    if (fs.existsSync(COOKIES_PATH)) {
        try {
            cookiesToSet = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        } catch {}
    }
    if (!cookiesToSet && global.__samInMemoryCookies) {
        cookiesToSet = global.__samInMemoryCookies;
    }
    if (cookiesToSet && Array.isArray(cookiesToSet) && cookiesToSet.length > 0) {
        try {
            await page.setCookie(...cookiesToSet);
        } catch (e) {
            logBrowserEvent('[AO3] Failed to set cookies on new page after login: ' + e.message);
        }
    }
    return { browser, page };
}


/**
 * (Fallback only) Appends ?view_adult=true to AO3 URLs if not already present.
 * Normally, AO3 login flow sets adult content access, so this is only needed if login is not used or fails.
 * Handles URLs with or without existing query parameters.
 * Leaves non-AO3 URLs unchanged.
 * @param {string} url - The URL to check/modify
 * @returns {string} - The updated URL
 */
function appendAdultViewParamIfNeeded(url) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('archiveofourown.org')) return url;
    // Already present
    if (url.includes('view_adult=true')) return url;
    // If there's a fragment, insert before it
    const hashIndex = url.indexOf('#');
    let base = url;
    let fragment = '';
    if (hashIndex !== -1) {
        base = url.substring(0, hashIndex);
        fragment = url.substring(hashIndex);
    }
    // Add param
    const sep = base.includes('?') ? '&' : '?';
    return base + sep + 'view_adult=true' + fragment;
}

module.exports = {
    getLoggedInAO3Page,
    appendAdultViewParamIfNeeded,
    debugLoginAndFetchWork,
    bypassStayLoggedInInterstitial
};
