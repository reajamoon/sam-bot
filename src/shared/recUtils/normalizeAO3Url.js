// Utility to normalize AO3 URLs by stripping /chapters/chapterId
function normalizeAO3Url(url) {
  if (typeof url !== 'string') return url;
  // Only operate on AO3 work URLs
  const ao3WorkRegex = /^(https?:\/\/archiveofourown\.org\/works\/\d+)(?:\/chapters\/\d+)?(.*)$/i;
  const match = url.match(ao3WorkRegex);
  if (match) {
    // Rebuild the URL without the /chapters/ part
    return match[1] + (match[2] || '');
  }
  return url;
}

module.exports = normalizeAO3Url;
