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
    const { getLoggedInAO3Page, appendAdultViewParamIfNeeded } = require('./ao3Utils');
    const { parseAO3Metadata } = require('./ao3Parser');
    let html, browser, page, ao3Url;
    let loggedIn = false;
    ao3Url = url;
    try {
        ({ browser, page } = await getLoggedInAO3Page());
        await page.goto(ao3Url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        html = await page.content();
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
            browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.5',
                'Upgrade-Insecure-Requests': '1',
                'X-Sam-Bot-Info': 'Hi AO3 devs! This is Sam, a hand-coded Discord bot for a single small server. I only fetch header metadata for user recs and do not retrieve fic content. Contact: https://github.com/reajamoon/sam-bot'
            });
            await page.goto(ao3Url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            html = await page.content();
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
