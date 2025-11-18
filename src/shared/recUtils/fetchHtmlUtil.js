// fetchHtmlUtil.js
// Utility for fetching HTML (plain and with Puppeteer)

const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

async function fetchHTMLWithBrowser(url) {
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const html = await page.content();
    await browser.close();
    return html;
}

function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = {
    fetchHTML,
    fetchHTMLWithBrowser
};
