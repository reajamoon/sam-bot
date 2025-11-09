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
// ao3Utils.js
// Utility for logging in to AO3 with Puppeteer and returning a logged-in page

const puppeteer = require('puppeteer');

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
    const fs = require('fs');
    const COOKIES_PATH = 'ao3_cookies.json';
    if (!username || !password) {
        throw new Error('AO3_USERNAME or AO3_PASSWORD is missing from environment.');
    }
    const browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1'
    });

    if (fs.existsSync(COOKIES_PATH)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
            await page.goto('https://archiveofourown.org/', { waitUntil: 'domcontentloaded' });
            await page.setCookie(...cookies);
            await page.reload({ waitUntil: 'domcontentloaded' });
            const content = await page.content();
            if (content.includes('Log Out') || content.includes('My Dashboard')) {
                return { browser, page, loggedInWithCookies: true };
            }
            // If not logged in, fall through to login flow
        } catch (err) {
            // If loading cookies fails, fall through to login flow
        }
    }
    // Go to login page
    await page.goto(AO3_LOGIN_URL, { waitUntil: 'domcontentloaded' });
    try {
        let pageContent = await page.content();
        // detect 'New Session' title in <head>
        if (await isNewSessionTitle(page)) {
            await page.goto(AO3_LOGIN_URL, { waitUntil: 'domcontentloaded' });
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
        // After login, check for error messages
        const postLoginContent = await page.content();
        if (!(postLoginContent.includes('Incorrect username or password') || postLoginContent.includes('error'))) {
            // Save cookies after successful login
            const cookies = await page.cookies();
            fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        }
    } catch (err) {
        throw new Error('AO3 login failed.');
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
