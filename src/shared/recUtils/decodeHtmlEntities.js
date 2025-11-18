// Universal HTML entity decoder
// Usage: decodeHtmlEntities(str)

function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x60;/g, '`')
        .replace(/&#x3D;/g, '=')
        .replace(/&#xA0;/g, ' ')
        .replace(/&#x2014;/g, '-')
        .replace(/&#x2019;/g, "'")
        .replace(/&#x201C;/g, '"')
        .replace(/&#x201D;/g, '"');
}

module.exports = decodeHtmlEntities;
