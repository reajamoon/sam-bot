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
    ao3Url = url;
    try {
        const loginResult = await getLoggedInAO3Page();
        browser = loginResult.browser;
        page = loginResult.page;
        // If logged in with cookies, always navigate to the fic URL
        if (loginResult.loggedInWithCookies) {
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
            return {
                title: 'Unknown Title',
                author: 'Unknown Author',
                url: ao3Url,
                error: 'AO3 session or login required',
                summary: 'AO3 is still requiring a login or new session after login attempt. Please wait a few minutes and try again.'
            };
        }
        await browser.close();
        loggedIn = isAO3LoggedInPage(html);
    } catch (e) {
        if (browser) await browser.close();
        loggedIn = false;
    }
    if (!loggedIn) {
        ao3Url = appendAdultViewParamIfNeeded ? appendAdultViewParamIfNeeded(url) : url;
        try {
            const puppeteer = require('puppeteer');
            const headless = process.env.AO3_HEADLESS === 'false' ? false : true;
            browser = await puppeteer.launch({ headless, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.5',
                'Upgrade-Insecure-Requests': '1',
                'X-Sam-Bot-Info': 'Hi AO3 devs! This is Sam, a hand-coded Discord bot for a single small server. I only fetch header metadata for user recs and do not retrieve fic content. Contact: https://github.com/reajamoon/sam-bot'
            });
            await page.goto(ao3Url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const currentUrl = page.url();
            const pageTitle = await page.title();
            const htmlSnap = await page.content();
            if (currentUrl.includes('/users/login?restricted=true&return_to=')) {
                await browser.close();
                return {
                    title: 'Unknown Title',
                    author: 'Unknown Author',
                    url: ao3Url,
                    error: 'AO3 session required',
                    summary: 'AO3 is requiring a login or new session. Please log in to AO3 and try again.'
                };
            }
            html = htmlSnap;
            await browser.close();
        } catch (e) {
            if (browser) await browser.close();
            html = null;
        }
    }
    if (html) {
        return parseAO3Metadata(html, ao3Url, includeRawHtml);
    }
    return null;
}

module.exports = { fetchAO3MetadataWithFallback, isAO3LoggedInPage };
