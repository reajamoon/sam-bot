// ao3Utils.js
// Utility for logging in to AO3 with Puppeteer and returning a logged-in page

const puppeteer = require('puppeteer');

/**
 * Logs in to AO3 and returns a logged-in Puppeteer page.
 * @returns {Promise<{ browser: import('puppeteer').Browser, page: import('puppeteer').Page }>}
 */
async function getLoggedInAO3Page() {
    const AO3_LOGIN_URL = 'https://archiveofourown.org/users/login';
    const username = process.env.AO3_USERNAME;
    const password = process.env.AO3_PASSWORD;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1'
    });

    // Go to login page
    await page.goto(AO3_LOGIN_URL, { waitUntil: 'domcontentloaded' });
    const fs = require('fs');
    try {
        // Check for "New Session" or interstitial page
        const pageContent = await page.content();
        fs.writeFileSync('ao3_login_debug.html', pageContent); // Save for inspection
        if (pageContent.includes('New Session')) {
            // Try clicking a button or link to continue
            const button = await page.$('input[type="submit"], button');
            if (button) {
                await Promise.all([
                    button.click(),
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 })
                ]);
            }
        }

        // Try main login form first
        let mainLoginExists = false;
        try {
            await page.waitForSelector('#user_login', { timeout: 3000 });
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
            await page.waitForSelector('#user_session_login_small', { timeout: 5000 });
            await page.type('#user_session_login_small', username);
            await page.type('#user_session_password_small', password);
            await Promise.all([
                page.click('#small_login input[name="commit"]'),
                page.waitForNavigation({ waitUntil: 'domcontentloaded' })
            ]);
        }

        // After login, check for error messages
        const postLoginContent = await page.content();
        if (postLoginContent.includes('Incorrect username or password') || postLoginContent.includes('error')) {
            fs.writeFileSync('ao3_login_debug_error.html', postLoginContent);
            console.error('AO3 login error detected after submit.');
        }
    } catch (err) {
        // Log the page content for debugging if login fails
        const content = await page.content();
        fs.writeFileSync('ao3_login_debug_error.html', content); // Save error page for inspection
        console.error('AO3 login failed. Page content:', content.substring(0, 1000));
        throw err;
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
    appendAdultViewParamIfNeeded
};
