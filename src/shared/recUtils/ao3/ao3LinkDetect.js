// ao3LinkDetect.js
// AO3 link detection logic

async function detectAO3LinksInHtml(html) {
    const result = {
        hasAO3Links: false,
        links: [],
        primaryLink: null
    };
    const ao3Patterns = [
        /https?:\/\/(?:www\.)?archiveofourown\.org\/works\/(\d+)(?:\/chapters\/\d+)?[^\s"<>]*/gi,
        /https?:\/\/(?:www\.)?ao3\.org\/works\/(\d+)(?:\/chapters\/\d+)?[^\s"<>]*/gi
    ];
    for (const pattern of ao3Patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const fullUrl = match[0];
            const workId = match[1];
            const cleanUrl = fullUrl.replace(/[.,;:!?]+$/, '');
            result.links.push({
                url: cleanUrl,
                workId: workId,
                foundAt: match.index
            });
            result.hasAO3Links = true;
        }
    }
    if (result.links.length > 0) {
        result.primaryLink = result.links[0];
    }
    const textPatterns = [
        /(?:read\s+(?:on|at|more on)\s+)?(?:ao3|archive\s+of\s+our\s+own)/gi,
        /(?:full\s+(?:fic|story|work)\s+(?:on|at))\s+ao3/gi,
        /(?:continue\s+reading\s+(?:on|at))\s+ao3/gi
    ];
    for (const pattern of textPatterns) {
        if (html.match(pattern)) {
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


export { detectAO3LinksInHtml };
