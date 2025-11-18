// Checks if a URL looks like a fanfic site. If someone sneaks in a YouTube link, just ignore it.
// Only supports actual fanfic sites (and tumblr lol), no random stuff.
function isValidFanficUrl(url) {
	const supportedSites = [
		/^https?:\/\/(www\.)?archiveofourown\.org\/works\/\d+/,
		/^https?:\/\/(www\.)?fanfiction\.net\/s\/\d+/,
		/^https?:\/\/(www\.)?wattpad\.com\/story\/\d+/,
		/^https?:\/\/.+\.livejournal\.com\/.+/,
		/^https?:\/\/.+\.dreamwidth\.org\/.+/,
		/^https?:\/\/.+\.tumblr\.com\/(post\/\d+|(\d+)).*/,
		/^https?:\/\/(www\.)?tumblr\.com\/.*/
	];
	return supportedSites.some(re => re.test(url));
}

module.exports = isValidFanficUrl;
