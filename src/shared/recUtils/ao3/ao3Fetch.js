const updateMessages = require('../../../commands/recHandlers/updateMessages');
// ao3Fetch.js
// AO3 login/fallback fetch logic

function isAO3LoggedInPage(html) {
    if (!html) return false;
    if (html.includes('<li class="user menu"')) return true;
    if (html.includes('<form id="loginform"')) return false;
    if (html.match(/>Log Out<|>Log out</i)) return true;
    if (html.match(/>Log In<|>Log in</i)) return false;
    if (html.match(/<li class="user menu"[\s\S]*?<a[^>]+href="\/users\//)) return true;
    return false;
}

async function fetchAO3MetadataWithFallback(url, includeRawHtml = false) {
    const { getLoggedInAO3Page, appendAdultViewParamIfNeeded, bypassStayLoggedInInterstitial } = require('./ao3Utils');
    const { parseAO3Metadata } = require('./ao3Parser');
    let html, browser, page, ao3Url;
    let loggedIn = false;
    let retried = false;
    ao3Url = url;
    const fs = require('fs');
    const path = require('path');
    const LOG_FAILED_HTML = true;
    const FAILED_HTML_DIR = path.join(process.cwd(), 'logs', 'ao3_failed_html');
    if (LOG_FAILED_HTML && !fs.existsSync(FAILED_HTML_DIR)) {
        fs.mkdirSync(FAILED_HTML_DIR, { recursive: true });
    }
    async function doLoginAndFetch() {
        // Always delete cookies and reset in-memory cookies before each login attempt if previous attempt failed
        const loginResult = await getLoggedInAO3Page();
        browser = loginResult.browser;
        page = loginResult.page;
        // Always navigate to the fic URL after login, regardless of login method
        await page.goto(ao3Url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        // Bypass 'stay logged in' interstitial if present
        await bypassStayLoggedInInterstitial(page, ao3Url);
        // AO3-specific: detect rate-limiting or CAPTCHA/anti-bot pages (title and error containers only)
        const pageTitle = await page.title();
        const errorText = await page.evaluate(() => {
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
            console.warn('[AO3] Rate limit or CAPTCHA detected during fetch (title or error container).');
            html = null;
            // Defensive: always delete cookies and reset in-memory cookies on rate limit
            const COOKIES_PATH = 'ao3_cookies.json';
            const fs = require('fs');
            if (fs.existsSync(COOKIES_PATH)) {
                try { fs.unlinkSync(COOKIES_PATH); console.warn('[AO3] Deleted cookies file due to rate limit/CAPTCHA.'); } catch {}
            }
            if (global.__samInMemoryCookies) {
                global.__samInMemoryCookies = null;
                console.warn('[AO3] In-memory cookies reset due to rate limit/CAPTCHA.');
            }
            return false;
        }
        html = await page.content();
        // Extra check: ensure not still on login/interstitial page
        let currentUrl = page.url();
        if (
            html.includes('<form id="loginform"') ||
            /New\s*Session/i.test(pageTitle) ||
            currentUrl.includes('/users/login')
        ) {
            // Defensive: always delete cookies and reset in-memory cookies on login/interstitial page
            const COOKIES_PATH = 'ao3_cookies.json';
            const fs = require('fs');
            if (fs.existsSync(COOKIES_PATH)) {
                try { fs.unlinkSync(COOKIES_PATH); console.warn('[AO3] Deleted cookies file due to login/interstitial page.'); } catch {}
            }
            if (global.__samInMemoryCookies) {
                global.__samInMemoryCookies = null;
                console.warn('[AO3] In-memory cookies reset due to login/interstitial page.');
            }
            return false;
        }
        loggedIn = isAO3LoggedInPage(html);
        return true;
    }

    let ok = false;
    let attempts = 1;
    const maxAttempts = 2;
    let lastError = null;
    try {
        ok = await doLoginAndFetch();
        while ((!ok || !html) && attempts < maxAttempts) {
            // If we failed, delete cookies and try again
            const COOKIES_PATH = 'ao3_cookies.json';
            if (fs.existsSync(COOKIES_PATH)) {
                console.warn('[AO3] Detected login/interstitial page. Deleting cookies and retrying login.');
                try { fs.unlinkSync(COOKIES_PATH); } catch {}
            }
            retried = true;
            try {
                ok = await doLoginAndFetch();
            } catch (err) {
                lastError = err;
                ok = false;
            }
            attempts++;
        }
        if (ok && html) {
            let parsed = parseAO3Metadata(html, ao3Url, includeRawHtml);
            // If parser detects AO3 session required, retry login/fetch once
            if (parsed && parsed.error === 'AO3 session required' && attempts < maxAttempts) {
                console.warn('[AO3] Parser detected session page after fetch. Retrying login/fetch.');
                // Defensive: delete cookies and reset in-memory cookies
                const COOKIES_PATH = 'ao3_cookies.json';
                if (fs.existsSync(COOKIES_PATH)) {
                    try { fs.unlinkSync(COOKIES_PATH); console.warn('[AO3] Deleted cookies file due to parser session detection.'); } catch {}
                }
                if (global.__samInMemoryCookies) {
                    global.__samInMemoryCookies = null;
                    console.warn('[AO3] In-memory cookies reset due to parser session detection.');
                }
                retried = true;
                try {
                    ok = await doLoginAndFetch();
                    if (ok && html) {
                        parsed = parseAO3Metadata(html, ao3Url, includeRawHtml);
                    }
                } catch (err) {
                    lastError = err;
                    ok = false;
                }
                attempts++;
            }
            return parsed;
        }
        // If we failed all attempts, log and return a clear error
        const cooldownMs = 60000; // 1 minute cooldown after repeated failures
        console.error('[AO3] AO3 fetch failed after multiple attempts. Entering cooldown. Last error:', lastError ? lastError.message : '(none)');
        if (LOG_FAILED_HTML && html) {
            try {
                const safeUrl = ao3Url.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
                const fname = `fail_${Date.now()}_${safeUrl}.html`;
                const fpath = path.join(FAILED_HTML_DIR, fname);
                fs.writeFileSync(fpath, html, 'utf8');
                console.warn(`[AO3] Saved failed HTML to ${fpath}`);
            } catch (err) {
                console.warn('[AO3] Failed to save failed HTML:', err);
            }
        }
        // Cooldown to avoid hammering AO3 if something is wrong
        await new Promise(res => setTimeout(res, cooldownMs));
        return {
            title: 'Unknown Title',
            author: 'Unknown Author',
            url: ao3Url,
            error: lastError ? `AO3 session or login failed: ${lastError.message}` : 'AO3 session or login required',
            summary: updateMessages.loginMessage
        };
    } finally {
        if (page && !page.isClosed()) {
            await page.close();
        }
    }
}

module.exports = { fetchAO3MetadataWithFallback, isAO3LoggedInPage };
