// Utility to extract stats from a Cheerio <dl class="stats"> block
// Returns { stats: { ... }, unknownStats: { ... } }

/**
 * Extracts AO3 stats from a <dl class="stats"> block.
 * @param {CheerioStatic} $ - The Cheerio instance.
 * @param {Cheerio} statsBlock - The <dl class="stats"> element.
 * @returns {{ stats: Object, unknownStats: Object }}
 */
function parseStatsBlock($, statsBlock) {
    const stats = {};
    const unknownStats = {};
    if (!statsBlock || statsBlock.length === 0) return { stats, unknownStats };
    let lastLabel = null;
    statsBlock.children().each((i, el) => {
        const $el = $(el);
        if (el.tagName === 'dt') {
            lastLabel = $el.text().replace(/[:\s\(\)]+/g, '_').toLowerCase().replace(/_+$/,'').replace(/^_+/, '');
        } else if (el.tagName === 'dd' && lastLabel) {
            let val = $el.text().replace(/,/g, '').trim();
            // Try to convert to int, else keep as string
            let num = parseInt(val, 10);
            let value = isNaN(num) ? val : num;
            // Known stats fields
            if ([
                'published', 'updated', 'completed', 'words', 'chapters', 'comments', 'kudos', 'bookmarks', 'hits'
            ].includes(lastLabel)) {
                stats[lastLabel] = value;
            } else {
                unknownStats[lastLabel] = value;
            }
            lastLabel = null;
        }
    });
    return { stats, unknownStats };
}

module.exports = parseStatsBlock;
