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
    async function doLoginAndFetch() {
        const loginResult = await getLoggedInAO3Page();
        browser = loginResult.browser;
        page = loginResult.page;
        // If logged in with cookies, always navigate to the fic URL
        if (loginResult.loggedInWithCookies) {
            console.log('[AO3] Navigated with cookies.');
            await page.goto(ao3Url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
        // Check for login redirect
        let currentUrl = page.url();
        if (currentUrl.includes('/users/login?restricted=true&return_to=')) {
            // Perform login (should already be logged in, but just in case)
            // After login, go back to the original work URL
            await page.goto(ao3Url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
        // Bypass 'stay logged in' interstitial if present
        await bypassStayLoggedInInterstitial(page, ao3Url);
        html = await page.content();
        // Extra check: ensure not still on login/interstitial page
        const pageTitle = await page.title();
        if (
            html.includes('<form id="loginform"') ||
            /New\s*Session/i.test(pageTitle) ||
            currentUrl.includes('/users/login')
        ) {
            await browser.close();
            return false;
        }
        await browser.close();
        loggedIn = isAO3LoggedInPage(html);
        return true;
    }

    let ok = await doLoginAndFetch();
    if (!ok) {
        // If we failed, delete cookies and try again once
        const fs = require('fs');
        const COOKIES_PATH = 'ao3_cookies.json';
        if (fs.existsSync(COOKIES_PATH)) {
            console.warn('[AO3] Detected login/interstitial page. Deleting cookies and retrying login.');
            try { fs.unlinkSync(COOKIES_PATH); } catch {}
        }
        retried = true;
        ok = await doLoginAndFetch();
    }
    if (ok && html) {
        return parseAO3Metadata(html, ao3Url, includeRawHtml);
    }
    return {
        title: 'Unknown Title',
        author: 'Unknown Author',
        url: ao3Url,
        error: 'AO3 session or login required',
        summary: 'AO3 is still requiring a login or new session after login attempt. Please wait a few minutes and try again.'
    };
}

module.exports = { fetchAO3MetadataWithFallback, isAO3LoggedInPage };
