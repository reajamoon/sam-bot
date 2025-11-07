/**
 * Fetches HTML using Puppeteer (headless browser)
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} - The page HTML
 */
async function fetchHTMLWithBrowser(url) {
    const puppeteer = require('puppeteer');
    // Always append ?view_adult=true for AO3 URLs
    let urlToFetch = url;
    if (urlToFetch.includes('archiveofourown.org') && !urlToFetch.includes('view_adult=true')) {
        urlToFetch += (urlToFetch.includes('?') ? '&' : '?') + 'view_adult=true';
    }
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1'
    });
    await page.goto(urlToFetch, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const html = await page.content();
    await browser.close();
    return html;
}
const https = require('https');
const http = require('http');

/**
 * Quick check if a URL is accessible (HEAD request)
 */
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

/**
 * Fetches fanfiction metadata from supported sites
 * @param {string} url - The fanfiction URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object|null>} - Metadata object or null if failed
 */
async function fetchFicMetadata(url, includeRawHtml = false) {
    // Add overall timeout to prevent Discord interaction expiry
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Metadata fetch timeout - taking too long')), 10000)
    );

    // Always append ?view_adult=true for AO3 URLs
    let urlToFetch = url;
    if (urlToFetch.includes('archiveofourown.org') && !urlToFetch.includes('view_adult=true')) {
        urlToFetch += (urlToFetch.includes('?') ? '&' : '?') + 'view_adult=true';
    }

    const fetchPromise = async () => {
        try {
            let metadata = null;
            let source = null;

            if (urlToFetch.includes('archiveofourown.org')) {
                // Use Puppeteer for AO3
                const { fetchHTMLWithBrowser } = require('./ficParser');
                const html = await fetchHTMLWithBrowser(urlToFetch);
                metadata = await fetchAO3MetadataFromHtml(html, urlToFetch, includeRawHtml);
                source = 'ao3';
            } else if (urlToFetch.includes('fanfiction.net')) {
                metadata = await fetchFFNetMetadata(urlToFetch, includeRawHtml);
                source = 'ffnet';
            } else if (urlToFetch.includes('wattpad.com')) {
                metadata = await fetchWattpadMetadata(urlToFetch, includeRawHtml);
                source = 'wattpad';
            } else if (urlToFetch.includes('livejournal.com') || urlToFetch.includes('.livejournal.com')) {
                metadata = await fetchLiveJournalMetadata(urlToFetch, includeRawHtml);
                source = 'livejournal';
            } else if (urlToFetch.includes('dreamwidth.org') || urlToFetch.includes('.dreamwidth.org')) {
                metadata = await fetchDreamwidthMetadata(urlToFetch, includeRawHtml);
                source = 'dreamwidth';
            } else if (urlToFetch.includes('tumblr.com') || urlToFetch.includes('.tumblr.com')) {
                metadata = await fetchTumblrMetadata(urlToFetch, includeRawHtml);
                source = 'tumblr';
            }

            if (metadata && source) {
                return normalizeMetadata(metadata, source);
            }

            return metadata;
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return null;
        }
    };
// Helper for AO3: parse metadata from HTML
async function fetchAO3MetadataFromHtml(html, url, includeRawHtml = false) {
    try {
        if (!html) return null;

        // Check for Cloudflare or other protection
        if (html.includes('challenge') || html.includes('cloudflare') || html.includes('Enable JavaScript')) {
            return {
                title: 'Unknown Title',
                author: 'Unknown Author',
                url: url,
                error: 'Site protection detected',
                summary: 'Site protection is blocking metadata fetch.'
            };
        }

        const metadata = { url: url };

        // Title
        const titleMatch = html.match(/<h2 class="title heading">\s*([^<]+)/);
        metadata.title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

        // Author
        const authorMatch = html.match(/<a rel="author" href="[^"]*">([^<]+)/);
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        // Summary
        const summaryMatch = html.match(/<div class="summary module">[\s\S]*?<blockquote class="userstuff">\s*<p>([\s\S]*?)<\/p>/);
        if (summaryMatch) {
            metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        // Fandom
        const fandomMatch = html.match(/<dd class="fandom tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.fandom = fandomMatch ? fandomMatch[1].trim() : null;

        // Rating
        const ratingMatch = html.match(/<dd class="rating tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.rating = ratingMatch ? ratingMatch[1].trim() : null;

        // Word count
        const wordMatch = html.match(/<dt class="words">Words:<\/dt><dd class="words">([^<]+)/);
        if (wordMatch) {
            metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
        }

        // Chapters
        const chapterMatch = html.match(/<dt class="chapters">Chapters:<\/dt><dd class="chapters">([^<]+)/);
        metadata.chapters = chapterMatch ? chapterMatch[1].trim() : null;

        // Status
        if (metadata.chapters && metadata.chapters.includes('/')) {
            const [current, total] = metadata.chapters.split('/');
            metadata.status = current === total ? 'Complete' : 'Work in Progress';
        }

        // Tags
        const tagMatches = html.match(/<dd class="freeform tags">[\s\S]*?<\/dd>/);
        if (tagMatches) {
            const tagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Language
        const langMatch = html.match(/<dd class="language" lang="[^"]*">([^<]+)/);
        metadata.language = langMatch ? langMatch[1].trim() : 'English';

        // Published date
        const publishedMatch = html.match(/<dt class="published">Published:<\/dt><dd class="published">([^<]+)/);
        if (publishedMatch) {
            metadata.publishedDate = new Date(publishedMatch[1].trim()).toISOString().split('T')[0];
        }

        // Updated date
        const updatedMatch = html.match(/<dt class="status">Completed:<\/dt><dd class="status">([^<]+)/);
        if (updatedMatch) {
            metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
        }

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        console.error('Error parsing AO3 metadata from HTML:', error);
        return null;
    }
}
    
    try {
        return await Promise.race([fetchPromise(), timeoutPromise]);
    } catch (error) {
        console.error('Metadata fetch failed or timed out:', error.message);
        return null;
    }
}

/**
 * Fetches metadata from Archive of Our Own
 */
async function fetchAO3Metadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) return null;

        // Check for Cloudflare or other protection
        if (html.includes('challenge') || html.includes('cloudflare') || html.includes('Enable JavaScript')) {
            console.log('Cloudflare protection detected on AO3');
            const result = {
                title: 'Unknown Title',
                author: 'Unknown Author',
                url: url,
                error: 'Site protection detected',
                summary: 'Yeah, so this site has some serious security measures that are blocking me from reading the story details. Think of it like warding - keeps the bad stuff out, but also keeps me from doing my job.'
            };
            if (includeRawHtml) result.rawHtml = html;
            return result;
        }

        const metadata = { url: url };

        // Title - updated pattern
        const titleMatch = html.match(/<h2 class="title heading">\s*([^<]+)/);
        metadata.title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

        // Author - updated pattern
        const authorMatch = html.match(/<a rel="author" href="[^"]*">([^<]+)/);
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        // Summary - updated pattern
        const summaryMatch = html.match(/<div class="summary module">[\s\S]*?<blockquote class="userstuff">\s*<p>([\s\S]*?)<\/p>/);
        if (summaryMatch) {
            metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        // Fandom - updated pattern
        const fandomMatch = html.match(/<dd class="fandom tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.fandom = fandomMatch ? fandomMatch[1].trim() : null;

        // Rating - updated pattern
        const ratingMatch = html.match(/<dd class="rating tags">[\s\S]*?<a[^>]*>([^<]+)/);
        metadata.rating = ratingMatch ? ratingMatch[1].trim() : null;

        // Word count - updated pattern
        const wordMatch = html.match(/<dt class="words">Words:<\/dt><dd class="words">([^<]+)/);
        if (wordMatch) {
            metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
        }

        // Chapters - updated pattern
        const chapterMatch = html.match(/<dt class="chapters">Chapters:<\/dt><dd class="chapters">([^<]+)/);
        metadata.chapters = chapterMatch ? chapterMatch[1].trim() : null;

        // Status (complete/incomplete)
        if (metadata.chapters && metadata.chapters.includes('/')) {
            const [current, total] = metadata.chapters.split('/');
            metadata.status = current === total ? 'Complete' : 'Work in Progress';
        }

        // Tags - updated pattern for freeform tags
        const tagMatches = html.match(/<dd class="freeform tags">[\s\S]*?<\/dd>/);
        if (tagMatches) {
            const tagRegex = /<a[^>]*class="tag"[^>]*>([^<]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Language
        const langMatch = html.match(/<dd class="language" lang="[^"]*">([^<]+)/);
        metadata.language = langMatch ? langMatch[1].trim() : 'English';

        // Published date - updated pattern
        const publishedMatch = html.match(/<dt class="published">Published:<\/dt><dd class="published">([^<]+)/);
        if (publishedMatch) {
            metadata.publishedDate = new Date(publishedMatch[1].trim()).toISOString().split('T')[0];
        }

        // Updated date - updated pattern  
        const updatedMatch = html.match(/<dt class="status">Completed:<\/dt><dd class="status">([^<]+)/);
        if (updatedMatch) {
            metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
        }

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        console.error('Error parsing AO3 metadata:', error);
        return null;
    }
}

/**
 * Fetches metadata from FanFiction.Net
 */
async function fetchFFNetMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) return null;

        console.log('FFNet HTML length:', html.length);

        // Check for Cloudflare or other protection
        if (html.includes('challenge') || html.includes('cloudflare') || html.includes('Enable JavaScript')) {
            console.log('Cloudflare protection detected on FFNet');
            const result = {
                title: 'Unknown Title',
                author: 'Unknown Author',
                url: url,
                error: 'Site protection detected',
                summary: 'Yeah, so this site has some serious security measures that are blocking me from reading the story details. Think of it like warding - keeps the bad stuff out, but also keeps me from doing my job.'
            };
            if (includeRawHtml) result.rawHtml = html.substring(0, 500) + '...';
            return result;
        }
    } catch (error) {
        // Handle HTTP errors
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Story Not Found',
                author: 'Unknown Author',
                url: url,
                error: '404_not_found',
                summary: 'This story appears to have been deleted or moved. The link is no longer working. You might want to check if the author has reposted it elsewhere.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This story is restricted or requires special permissions to access. It might be locked to registered users only.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this story. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }
        
        console.error('Error fetching FFNet metadata:', error);
        return null;
    }

    try {
        const metadata = { url: url };

        // Multiple patterns for title - FFNet has changed their HTML structure over time
        let titleMatch = html.match(/<b class='xcontrast_txt'>([^<]+)/);
        if (!titleMatch) {
            titleMatch = html.match(/<title>([^|]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace('Chapter 1:', '').trim();
            }
        } else {
            metadata.title = titleMatch[1].trim();
        }
        
        if (!metadata.title) {
            metadata.title = 'Unknown Title';
        }

        console.log('FFNet parsed title:', metadata.title);

        // Multiple patterns for author
        let authorMatch = html.match(/<a class='xcontrast_txt' href='\/u\/\d+\/[^']*'>([^<]+)/);
        if (!authorMatch) {
            authorMatch = html.match(/By:\s*<a[^>]*>([^<]+)/i);
        }
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        console.log('FFNet parsed author:', metadata.author);

        // Summary - multiple patterns
        let summaryMatch = html.match(/<div class='xcontrast_txt' style='margin-top:2px'>([^<]+)/);
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*class="[^"]*storytext[^"]*"[^>]*>(.*?)<\/div>/s);
            if (summaryMatch) {
                metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 500);
            }
        } else {
            metadata.summary = summaryMatch[1].trim();
        }

        console.log('FFNet parsed summary:', metadata.summary?.substring(0, 100));

        // Try to find metadata in various formats
        const metaPatterns = [
            /<span class='xgray xcontrast_txt'>([^<]+)/,
            /<span[^>]*class="[^"]*xgray[^"]*"[^>]*>([^<]+)/,
            /<div[^>]*id="profile_top"[^>]*>(.*?)<\/div>/s
        ];

        let metaText = '';
        for (const pattern of metaPatterns) {
            const match = html.match(pattern);
            if (match) {
                metaText = match[1];
                break;
            }
        }

        console.log('FFNet metadata text:', metaText.substring(0, 200));

        if (metaText) {
            // Look for rating
            const ratingMatch = metaText.match(/Rated:\s*([^-\s]+)/i);
            metadata.rating = ratingMatch ? ratingMatch[1].trim() : 'Not Rated';

            // Look for language
            const languageMatch = metaText.match(/(?:English|Spanish|French|German|Italian|Portuguese|Russian)\b/i);
            metadata.language = languageMatch ? languageMatch[0] : 'English';

            // Look for word count
            const wordMatch = metaText.match(/Words:\s*([\d,]+)/i);
            if (wordMatch) {
                metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
            }

            // Look for chapters
            const chapterMatch = metaText.match(/Chapters:\s*(\d+)/i);
            metadata.chapters = chapterMatch ? chapterMatch[1] : '1';

            // Status
            metadata.status = metaText.match(/Complete/i) ? 'Complete' : 'Work in Progress';

            // Look for published/updated dates
            const publishedMatch = metaText.match(/Published:\s*([^-]+)/i);
            if (publishedMatch) {
                try {
                    metadata.publishedDate = new Date(publishedMatch[1].trim()).toISOString().split('T')[0];
                } catch (e) {
                    console.log('Could not parse published date:', publishedMatch[1]);
                }
            }

            const updatedMatch = metaText.match(/Updated:\s*([^-]+)/i);
            if (updatedMatch) {
                try {
                    metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
                } catch (e) {
                    console.log('Could not parse updated date:', updatedMatch[1]);
                }
            }
        }

        console.log('FFNet final metadata:', JSON.stringify(metadata, null, 2));
        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        console.error('Error parsing FFNet metadata:', error);
        return null;
    }
}

/**
 * Fetches metadata from Wattpad
 */
async function fetchWattpadMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) return null;

        const metadata = { url: url };

        // Title - Wattpad uses various patterns
        let titleMatch = html.match(/<h1[^>]*class="[^"]*story-title[^"]*"[^>]*>([^<]+)/);
        if (!titleMatch) {
            titleMatch = html.match(/<title>([^|]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace(' - Wattpad', '').trim();
            }
        } else {
            metadata.title = titleMatch[1].trim();
        }
        
        if (!metadata.title) {
            metadata.title = 'Unknown Title';
        }

        // Author - look for username patterns
        let authorMatch = html.match(/<a[^>]*href="\/user\/[^"]*"[^>]*>([^<]+)/);
        if (!authorMatch) {
            authorMatch = html.match(/"username":"([^"]+)"/);
        }
        if (!authorMatch) {
            authorMatch = html.match(/by\s+([^<\n]+)/i);
        }
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        // Description/Summary - Wattpad uses description class
        let summaryMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/s);
        if (!summaryMatch) {
            summaryMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
        }
        if (summaryMatch) {
            metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim();
            if (metadata.summary.length > 500) {
                metadata.summary = metadata.summary.substring(0, 500) + '...';
            }
        }

        // Try to extract JSON data that Wattpad embeds
        const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                
                // Extract story data from the JSON
                if (data.story) {
                    metadata.title = data.story.title || metadata.title;
                    metadata.author = data.story.user?.username || metadata.author;
                    metadata.summary = data.story.description || metadata.summary;
                    
                    if (data.story.numParts) {
                        metadata.chapters = data.story.numParts.toString();
                    }
                    
                    if (data.story.isCompleted !== undefined) {
                        metadata.status = data.story.isCompleted ? 'Complete' : 'Work in Progress';
                    }
                    
                    // Language
                    metadata.language = data.story.language?.name || 'English';
                    
                    // Tags
                    if (data.story.tags && Array.isArray(data.story.tags)) {
                        metadata.tags = data.story.tags.map(tag => tag.name || tag).slice(0, 10);
                    }
                    
                    // Reading time (Wattpad specific)
                    if (data.story.readingTime) {
                        metadata.readingTime = data.story.readingTime;
                    }
                    
                    // Reads and votes (Wattpad metrics)
                    if (data.story.readCount) {
                        metadata.reads = data.story.readCount;
                    }
                    if (data.story.voteCount) {
                        metadata.votes = data.story.voteCount;
                    }
                }
            } catch (e) {
                console.log('Could not parse Wattpad JSON data:', e.message);
            }
        }

        // Fallback patterns for basic info
        if (!metadata.chapters) {
            const chaptersMatch = html.match(/(\d+)\s*parts?/i);
            metadata.chapters = chaptersMatch ? chaptersMatch[1] : '1';
        }

        // Look for reads and votes in the HTML
        if (!metadata.reads) {
            const readsMatch = html.match(/([\d,]+)\s*reads?/i);
            if (readsMatch) {
                metadata.reads = parseInt(readsMatch[1].replace(/,/g, ''));
            }
        }

        if (!metadata.votes) {
            const votesMatch = html.match(/([\d,]+)\s*votes?/i);
            if (votesMatch) {
                metadata.votes = parseInt(votesMatch[1].replace(/,/g, ''));
            }
        }

        // Default values
        metadata.rating = 'Not Rated'; // Wattpad doesn't use traditional ratings
        metadata.language = metadata.language || 'English';
        metadata.status = metadata.status || 'Unknown';

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        // Handle HTTP errors from fetchHTML
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Story Not Found',
                author: 'Unknown Author',
                url: url,
                error: '404_not_found',
                summary: 'This story appears to have been deleted or moved. The link is no longer working. You might want to check if the author has reposted it elsewhere.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This story is restricted or requires special permissions to access. It might be private or requires account login.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this story. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }
        
        console.error('Error parsing Wattpad metadata:', error);
        return null;
    }
}

/**
 * Fetches metadata from LiveJournal
 */
async function fetchLiveJournalMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) {
            return createFallbackMetadata(url, 'livejournal', 'Could not fetch content from LiveJournal');
        }

        const metadata = { url: url };

        // LiveJournal titles can be in various formats
        let titleMatch = html.match(/<title>([^<]+)/);
        if (titleMatch) {
            metadata.title = titleMatch[1].replace(/\s*-\s*[^-]*LiveJournal/, '').trim();
        } else {
            metadata.title = 'LiveJournal Post';
        }

        // Author - look for journal username
        let authorMatch = url.match(/https?:\/\/([^.]+)\.livejournal\.com/);
        if (!authorMatch) {
            authorMatch = html.match(/<span[^>]*class="[^"]*ljuser[^"]*"[^>]*>([^<]+)/);
        }
        if (!authorMatch) {
            authorMatch = html.match(/journal[:\s]+([^<\s,]+)/i);
        }
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        // Content/Summary - LiveJournal posts use various content divs
        let summaryMatch = html.match(/<div[^>]*class="[^"]*entry[^"]*"[^>]*>(.*?)<\/div>/s);
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*id="[^"]*entry[^"]*"[^>]*>(.*?)<\/div>/s);
        }
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*class="[^"]*asset-body[^"]*"[^>]*>(.*?)<\/div>/s);
        }
        
        if (summaryMatch) {
            const cleanContent = summaryMatch[1]
                .replace(/<script[^>]*>.*?<\/script>/gs, '')
                .replace(/<style[^>]*>.*?<\/style>/gs, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            metadata.summary = cleanContent.length > 300 
                ? cleanContent.substring(0, 300) + '...' 
                : cleanContent;
        }

        // Tags - LiveJournal uses various tag patterns
        const tagMatches = html.match(/<div[^>]*class="[^"]*ljtags[^"]*"[^>]*>(.*?)<\/div>/s);
        if (tagMatches) {
            const tagRegex = /<a[^>]*>([^<]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Date - look for posting date
        let dateMatch = html.match(/<span[^>]*class="[^"]*datetime[^"]*"[^>]*>([^<]+)/);
        if (!dateMatch) {
            dateMatch = html.match(/(\w+\s+\d{1,2},?\s+\d{4})/);
        }
        if (dateMatch) {
            try {
                metadata.publishedDate = new Date(dateMatch[1]).toISOString().split('T')[0];
            } catch (e) {
                // Date parsing failed, that's okay
            }
        }

        // Default values for LiveJournal
        metadata.chapters = '1';
        metadata.status = 'Complete';
        metadata.rating = 'Not Rated';
        metadata.language = 'English';

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        // Handle HTTP errors from fetchHTML
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Post Not Found',
                author: 'Unknown Author',
                url: url,
                error: '404_not_found',
                summary: 'This LiveJournal post appears to have been deleted or moved. The link is no longer working.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This LiveJournal post is private or restricted. You might need to be logged in or have special permissions to view it.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this LiveJournal post. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }
        
        console.error('Error parsing LiveJournal metadata:', error);
        return createFallbackMetadata(url, 'livejournal', 'Could not parse LiveJournal content');
    }
}

/**
 * Fetches metadata from Dreamwidth
 */
async function fetchDreamwidthMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) {
            return createFallbackMetadata(url, 'dreamwidth', 'Could not fetch content from Dreamwidth');
        }

        const metadata = { url: url };

        // Dreamwidth titles
        let titleMatch = html.match(/<title>([^<]+)/);
        if (titleMatch) {
            metadata.title = titleMatch[1].replace(/\s*-\s*[^-]*Dreamwidth/, '').trim();
        } else {
            metadata.title = 'Dreamwidth Post';
        }

        // Author - look for journal username
        let authorMatch = url.match(/https?:\/\/([^.]+)\.dreamwidth\.org/);
        if (!authorMatch) {
            authorMatch = html.match(/<span[^>]*class="[^"]*ljuser[^"]*"[^>]*>([^<]+)/);
        }
        if (!authorMatch) {
            authorMatch = html.match(/journal[:\s]+([^<\s,]+)/i);
        }
        metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';

        // Content/Summary - Dreamwidth uses similar structure to LiveJournal
        let summaryMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)<\/div>/s);
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*class="[^"]*asset-body[^"]*"[^>]*>(.*?)<\/div>/s);
        }
        
        if (summaryMatch) {
            const cleanContent = summaryMatch[1]
                .replace(/<script[^>]*>.*?<\/script>/gs, '')
                .replace(/<style[^>]*>.*?<\/style>/gs, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            metadata.summary = cleanContent.length > 300 
                ? cleanContent.substring(0, 300) + '...' 
                : cleanContent;
        }

        // Tags - Dreamwidth tag patterns
        const tagMatches = html.match(/<div[^>]*class="[^"]*tag[^"]*"[^>]*>(.*?)<\/div>/s);
        if (tagMatches) {
            const tagRegex = /<a[^>]*>([^<]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Date
        let dateMatch = html.match(/<span[^>]*class="[^"]*datetime[^"]*"[^>]*>([^<]+)/);
        if (!dateMatch) {
            dateMatch = html.match(/(\w+\s+\d{1,2},?\s+\d{4})/);
        }
        if (dateMatch) {
            try {
                metadata.publishedDate = new Date(dateMatch[1]).toISOString().split('T')[0];
            } catch (e) {
                // Date parsing failed, that's okay
            }
        }

        // Default values for Dreamwidth
        metadata.chapters = '1';
        metadata.status = 'Complete';
        metadata.rating = 'Not Rated';
        metadata.language = 'English';

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        // Handle HTTP errors from fetchHTML
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Post Not Found',
                author: 'Unknown Author',
                url: url,
                error: '404_not_found',
                summary: 'This Dreamwidth post appears to have been deleted or moved. The link is no longer working.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This Dreamwidth post is private or restricted. You might need to be logged in or have special permissions to view it.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this Dreamwidth post. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }
        
        console.error('Error parsing Dreamwidth metadata:', error);
        return createFallbackMetadata(url, 'dreamwidth', 'Could not parse Dreamwidth content');
    }
}

/**
 * Fetches metadata from Tumblr
 */
async function fetchTumblrMetadata(url, includeRawHtml = false) {
    try {
        const html = await fetchHTML(url);
        if (!html) {
            return createFallbackMetadata(url, 'tumblr', 'Could not fetch content from Tumblr');
        }

        // Check for Tumblr's various protection measures
        if (html.includes('Enable JavaScript') || html.includes('cf-browser-verification')) {
            // Try Puppeteer fallback for JS-required/protected pages
            try {
                const { fetchHTMLWithBrowser } = require('./ficParser');
                const browserHtml = await fetchHTMLWithBrowser(url);
                if (browserHtml && browserHtml.length > 1000 && !browserHtml.includes('Enable JavaScript') && !browserHtml.includes('cf-browser-verification')) {
                    // Use browserHtml for parsing
                    html = browserHtml;
                } else {
                    return createFallbackMetadata(url, 'tumblr', 'Tumblr requires JavaScript or has protection enabled');
                }
            } catch (e) {
                return createFallbackMetadata(url, 'tumblr', 'Tumblr requires JavaScript or has protection enabled');
            }
        }

        const metadata = { url: url };

        // Try to extract from JSON-LD structured data
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        if (jsonLdMatch) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1]);
                if (jsonData.headline) {
                    metadata.title = jsonData.headline;
                }
                if (jsonData.author && jsonData.author.name) {
                    metadata.author = jsonData.author.name;
                }
                if (jsonData.description) {
                    metadata.summary = jsonData.description;
                }
                if (jsonData.datePublished) {
                    metadata.publishedDate = new Date(jsonData.datePublished).toISOString().split('T')[0];
                }
            } catch (e) {
                // JSON parsing failed, continue with HTML parsing
            }
        }

        // Title - try various Tumblr patterns
        if (!metadata.title) {
            let titleMatch = html.match(/<title>([^<]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace(/\s*—\s*Tumblr$/, '').trim();
            } else {
                metadata.title = 'Tumblr Post';
            }
        }

        // Author - extract from URL or blog name
        if (!metadata.author) {
            let authorMatch = url.match(/https?:\/\/([^.]+)\.tumblr\.com/);
            if (!authorMatch) {
                authorMatch = html.match(/<span[^>]*class="[^"]*blog-name[^"]*"[^>]*>([^<]+)/);
            }
            metadata.author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';
        }

        // Reblog Detection - check if this is a reblog
        const isReblog = detectTumblrReblog(url, html);
        if (isReblog.isReblog) {
            metadata.isReblog = true;
            metadata.rebloggedBy = metadata.author; // The user from the URL
            metadata.reblogWarning = `⚠️ This appears to be a reblog by ${metadata.author}. The original author may be different. Please check the post content and manually enter the correct author name.`;
            
            // Try to find original author in content
            if (isReblog.originalAuthor) {
                metadata.suggestedAuthor = isReblog.originalAuthor;
                metadata.reblogWarning += ` Possible original author: ${isReblog.originalAuthor}`;
            }
        }

        // AO3 Link Detection - check if post contains AO3 links
        const ao3LinkDetection = await detectAO3LinksInTumblr(html);
        if (ao3LinkDetection.hasAO3Links) {
            metadata.hasAO3Links = true;
            metadata.ao3Links = ao3LinkDetection.links;
            metadata.ao3Suggestion = `📚 This Tumblr post contains AO3 link(s). Would you prefer to import from AO3 instead for better metadata?`;
            
            // If we found AO3 links, try to get their metadata for preview
            if (ao3LinkDetection.primaryLink) {
                try {
                    // Add timeout to prevent hanging interactions
                    const ao3MetadataPromise = fetchAO3Metadata(ao3LinkDetection.primaryLink.url);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('AO3 fetch timeout')), 5000)
                    );
                    
                    const ao3Metadata = await Promise.race([ao3MetadataPromise, timeoutPromise]);
                    
                    if (ao3Metadata && ao3Metadata.title && ao3Metadata.author) {
                        metadata.ao3Preview = {
                            url: ao3LinkDetection.primaryLink.url,
                            title: ao3Metadata.title,
                            author: ao3Metadata.author,
                            summary: ao3Metadata.summary?.substring(0, 200) + (ao3Metadata.summary?.length > 200 ? '...' : ''),
                            wordCount: ao3Metadata.wordCount,
                            rating: ao3Metadata.rating
                        };
                        metadata.ao3Suggestion = `📚 Found AO3 version: "${ao3Metadata.title}" by ${ao3Metadata.author}. Import from AO3 instead?`;
                    }
                } catch (e) {
                    // AO3 fetch failed or timed out, that's okay
                    console.log('Could not fetch AO3 preview:', e.message);
                }
            }
        }

        // Content/Summary - Tumblr post content
        if (!metadata.summary) {
            let summaryMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>(.*?)<\/div>/s);
            if (!summaryMatch) {
                summaryMatch = html.match(/<article[^>]*>(.*?)<\/article>/s);
            }
            if (!summaryMatch) {
                summaryMatch = html.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>(.*?)<\/div>/s);
            }
            
            if (summaryMatch) {
                const cleanContent = summaryMatch[1]
                    .replace(/<script[^>]*>.*?<\/script>/gs, '')
                    .replace(/<style[^>]*>.*?<\/style>/gs, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                metadata.summary = cleanContent.length > 300 
                    ? cleanContent.substring(0, 300) + '...' 
                    : cleanContent;
            }
        }

        // Tags - Tumblr has tag sections
        const tagMatches = html.match(/<div[^>]*class="[^"]*tags[^"]*"[^>]*>(.*?)<\/div>/s);
        if (tagMatches) {
            const tagRegex = /#([^<\s,]+)/g;
            metadata.tags = [];
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagMatches[0])) !== null) {
                metadata.tags.push(tagMatch[1].trim());
            }
        }

        // Notes (Tumblr's equivalent of engagement)
        const notesMatch = html.match(/(\d+)\s*notes?/i);
        if (notesMatch) {
            metadata.notes = parseInt(notesMatch[1]);
        }

        // Default values for Tumblr
        metadata.chapters = '1';
        metadata.status = 'Complete';
        metadata.rating = 'Not Rated';
        metadata.language = 'English';

        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (error) {
        // Handle HTTP errors from fetchHTML
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Post Not Found',
                author: 'Unknown Author',
                url: url,
                error: '404_not_found',
                summary: 'This Tumblr post appears to have been deleted or the blog was deactivated. The link is no longer working.',
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                author: 'Unknown Author',
                url: url,
                error: 'Access denied',
                summary: 'This Tumblr post is from a private blog or has restricted access. You might need special permissions to view it.',
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                author: 'Unknown Author',
                url: url,
                error: error.message,
                summary: 'There was a problem connecting to this Tumblr post. The site might be down or experiencing issues.',
                isHttpError: true
            };
        }
        
        console.error('Error parsing Tumblr metadata:', error);
        return createFallbackMetadata(url, 'tumblr', 'Could not parse Tumblr content');
    }
}

/**
 * Detects if a Tumblr post is a reblog and tries to find the original author
 */
function detectTumblrReblog(url, html) {
    const result = {
        isReblog: false,
        originalAuthor: null,
        confidence: 'low'
    };

    // Method 1: Check for reblog indicators in HTML
    const reblogIndicators = [
        /<div[^>]*class="[^"]*reblog[^"]*"/i,
        /<span[^>]*class="[^"]*reblog[^"]*"/i,
        /reblogged\s+from/i,
        /<a[^>]*href="[^"]*tumblr\.com[^"]*"[^>]*>[^<]*reblogged/i
    ];

    for (const indicator of reblogIndicators) {
        if (html.match(indicator)) {
            result.isReblog = true;
            result.confidence = 'medium';
            break;
        }
    }

    // Method 2: Check for "reblogged from" or "via" patterns
    const reblogPatterns = [
        /reblogged\s+from\s+([a-zA-Z0-9_-]+)/i,
        /via\s+([a-zA-Z0-9_-]+)/i,
        /<a[^>]*href="https?:\/\/([a-zA-Z0-9_-]+)\.tumblr\.com"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of reblogPatterns) {
        const match = html.match(pattern);
        if (match) {
            result.isReblog = true;
            result.originalAuthor = match[1];
            result.confidence = 'high';
            break;
        }
    }

    // Method 3: Check URL structure for reblog patterns
    // Tumblr reblogs often have specific URL structures
    const urlReblogPattern = /\/post\/\d+\/.*$/;
    if (urlReblogPattern.test(url)) {
        // If we found content patterns, this increases reblog likelihood
        if (result.confidence !== 'low') {
            result.isReblog = true;
        }
    }

    // Method 4: Look for attribution in post content
    const attributionPatterns = [
        /by\s+([a-zA-Z0-9_-]+)/i,
        /author[:\s]+([a-zA-Z0-9_-]+)/i,
        /written\s+by\s+([a-zA-Z0-9_-]+)/i,
        /@([a-zA-Z0-9_-]+)/g
    ];

    for (const pattern of attributionPatterns) {
        const matches = html.match(pattern);
        if (matches) {
            // Don't overwrite if we already found a good author
            if (!result.originalAuthor) {
                result.originalAuthor = matches[1];
            }
        }
    }

    // Method 5: Check for multiple blog names (indication of reblog chain)
    const blogNameMatches = html.match(/<span[^>]*class="[^"]*blog-name[^"]*"[^>]*>([^<]+)/g);
    if (blogNameMatches && blogNameMatches.length > 1) {
        result.isReblog = true;
        result.confidence = 'medium';
    }

    return result;
}

/**
 * Detects AO3 links in Tumblr post content
 */
async function detectAO3LinksInTumblr(html) {
    const result = {
        hasAO3Links: false,
        links: [],
        primaryLink: null
    };

    // AO3 URL patterns to look for
    const ao3Patterns = [
        /https?:\/\/(?:www\.)?archiveofourown\.org\/works\/(\d+)(?:\/chapters\/\d+)?[^\s"<>]*/gi,
        /https?:\/\/(?:www\.)?ao3\.org\/works\/(\d+)(?:\/chapters\/\d+)?[^\s"<>]*/gi
    ];

    for (const pattern of ao3Patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const fullUrl = match[0];
            const workId = match[1];
            
            // Clean up the URL (remove trailing punctuation that might be part of text)
            const cleanUrl = fullUrl.replace(/[.,;:!?]+$/, '');
            
            result.links.push({
                url: cleanUrl,
                workId: workId,
                foundAt: match.index
            });
            result.hasAO3Links = true;
        }
    }

    // If we found links, pick the first/primary one
    if (result.links.length > 0) {
        result.primaryLink = result.links[0];
    }

    // Also check for text-based AO3 references
    const textPatterns = [
        /(?:read\s+(?:on|at|more on)\s+)?(?:ao3|archive\s+of\s+our\s+own)/gi,
        /(?:full\s+(?:fic|story|work)\s+(?:on|at))\s+ao3/gi,
        /(?:continue\s+reading\s+(?:on|at))\s+ao3/gi
    ];

    for (const pattern of textPatterns) {
        if (html.match(pattern)) {
            // Look for nearby URLs even if not perfect AO3 format
            const nearbyUrlPattern = /https?:\/\/[^\s"<>]+/gi;
            let urlMatch;
            while ((urlMatch = nearbyUrlPattern.exec(html)) !== null) {
                const url = urlMatch[0];
                if (url.includes('archiveofourown') || url.includes('ao3')) {
                    result.links.push({
                        url: url,
                        workId: 'unknown',
                        foundAt: urlMatch.index,
                        textBased: true
                    });
                    result.hasAO3Links = true;
                    
                    if (!result.primaryLink) {
                        result.primaryLink = result.links[result.links.length - 1];
                    }
                }
            }
        }
    }

    return result;
}

/**
 * Creates fallback metadata when parsing fails
 */
function createFallbackMetadata(url, source, errorMessage) {
    const platformName = source.charAt(0).toUpperCase() + source.slice(1);
    
    const fallback = {
        url: url,
        title: `${platformName} Story`,
        author: 'Unknown Author',
        summary: `This story is hosted on ${platformName}. ${errorMessage}. You might want to manually add the story details using the manual fields.`,
        chapters: '1',
        status: 'Unknown',
        rating: 'Not Rated',
        language: 'English',
        error: errorMessage,
        requiresManualEntry: true
    };

    // Special handling for Tumblr - try to extract author and detect reblogs even in fallback
    if (source === 'tumblr') {
        const authorMatch = url.match(/https?:\/\/([^.]+)\.tumblr\.com/);
        if (authorMatch) {
            fallback.author = authorMatch[1];
            
            // Simple reblog detection based on URL patterns
            const urlReblogPattern = /\/post\/\d+\/.+/;
            if (urlReblogPattern.test(url)) {
                fallback.isReblog = true;
                fallback.rebloggedBy = authorMatch[1];
                fallback.reblogWarning = `⚠️ This appears to be a reblog by ${authorMatch[1]}. The original author may be different. Please manually enter the correct author name.`;
                fallback.summary = `This story is hosted on Tumblr. ${errorMessage}. ⚠️ This may be a reblog - please check the original author and manually add the correct story details.`;
            }
        }
    }
    
    return fallback;
}

/**
 * Fetches HTML content from a URL
 */
function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        // Always append ?view_adult=true for AO3 URLs
        let urlToFetch = url;
        if (urlToFetch.includes('archiveofourown.org') && !urlToFetch.includes('view_adult=true')) {
            urlToFetch += (urlToFetch.includes('?') ? '&' : '?') + 'view_adult=true';
        }
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        };

        https.get(urlToFetch, options, (res) => {
            // Check for HTTP error status codes
            if (res.statusCode === 404) {
                reject(new Error('HTTP_404_NOT_FOUND'));
                return;
            } else if (res.statusCode === 403) {
                reject(new Error('HTTP_403_FORBIDDEN'));
                return;
            } else if (res.statusCode === 500) {
                reject(new Error('HTTP_500_SERVER_ERROR'));
                return;
            } else if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
                reject(new Error(`HTTP_${res.statusCode}_ERROR`));
                return;
            }

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

/**
 * Normalizes metadata field names to AO3 terminology
 */
function normalizeMetadata(metadata, source) {
    const normalized = { ...metadata };
    
    if (source === 'wattpad') {
        // Wattpad normalization
        if (normalized.votes !== undefined) {
            normalized.kudos = normalized.votes;
            delete normalized.votes;
        }
        if (normalized.reads !== undefined) {
            normalized.hits = normalized.reads;
            delete normalized.reads;
        }
        if (normalized.parts !== undefined) {
            normalized.chapters = normalized.parts;
            delete normalized.parts;
        }
    } else if (source === 'ffnet') {
        // FFNet normalization
        if (normalized.favs !== undefined) {
            normalized.bookmarks = normalized.favs;
            delete normalized.favs;
        }
        if (normalized.reviews !== undefined) {
            normalized.comments = normalized.reviews;
            delete normalized.reviews;
        }
        if (normalized.genre !== undefined) {
            normalized.category = normalized.genre;
            delete normalized.genre;
        }
    } else if (source === 'tumblr') {
        // Tumblr normalization
        if (normalized.notes !== undefined) {
            normalized.kudos = normalized.notes;
            delete normalized.notes;
        }
    }
    // LiveJournal and Dreamwidth don't have specific fields that need normalization
    
    return normalized;
}

module.exports = {
    fetchFicMetadata,
    quickLinkCheck,
    fetchHTML,
    fetchHTMLWithBrowser
};