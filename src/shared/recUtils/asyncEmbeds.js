import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import quickLinkCheck from './quickLinkCheck.js';
import isValidFanficUrl from './isValidFanficUrl.js';
import {
	isSeriesRec,
	buildBaseEmbed,
	buildStoryLinkText,
	getRatingAndColor,
	addWorkWarningsField,
	addSeriesWarningsField,
	addTagsField,
	addNotesField,
	addEngagementFields,
	addStatsFields,
	addStatusField
} from './createRecommendationEmbed.js';

// Async embed builder for a rec (single or series)
export async function createRecommendationEmbed(rec) {
	// If this work is part of a series, show series info
	if (rec.series && typeof rec.series === 'object' && rec.series.name && rec.series.url && rec.series.part) {
		const embed = buildBaseEmbed(rec, getRatingAndColor(rec.rating).color);
		embed.addFields({
			name: 'Series',
			value: `[Part ${rec.series.part} of ${rec.series.name}](${rec.series.url})`
		});
	}
	if (isSeriesRec(rec)) {
		return await createSeriesRecommendationEmbed(rec);
	}
	// Use shared helper for rating and color
	const { ratingValue, color } = getRatingAndColor(rec.rating);
	const embed = buildBaseEmbed(rec, color);
	if (rec.summary) {
		const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
		embed.addFields({
			name: 'Summary',
			value: `>>> ${summaryText}`
		});
	}
	const isLinkWorking = rec.deleted ? false : await quickLinkCheck(rec.url);
	const siteInfo = isValidFanficUrl(rec.url);
	const linkText = buildStoryLinkText(rec, isLinkWorking, siteInfo);
	const linkAndMetaFields = [
		{ name: '🔗 Story Link', value: linkText, inline: true }
	];
	if (rec.rating) linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
	addStatusField(linkAndMetaFields, rec);
	embed.addFields(linkAndMetaFields);
	addStatsFields(embed, rec);
	addWorkWarningsField(embed, rec);
	addTagsField(embed, rec);
	addNotesField(embed, rec);
	addEngagementFields(embed, rec);
	return embed;
}

// Async embed builder for a series rec
export async function createSeriesRecommendationEmbed(rec) {
	// Use series_works from rec.series if available
	const series = rec.series || {};
	let effectiveRating = rec.rating;
	const seriesWorks = Array.isArray(series.series_works) ? series.series_works : [];
	if ((!effectiveRating || effectiveRating.toLowerCase() === 'unrated' || effectiveRating.toLowerCase() === 'not rated') && seriesWorks.length > 0) {
		const ratingOrder = ['not rated', 'unrated', 'general audiences', 'teen and up audiences', 'mature', 'explicit'];
		let maxIdx = 0;
		for (const work of seriesWorks) {
			if (work.rating && typeof work.rating === 'string') {
				const idx = ratingOrder.indexOf(work.rating.trim().toLowerCase());
				if (idx > maxIdx) maxIdx = idx;
			}
		}
		effectiveRating = ratingOrder[maxIdx] || 'Unrated';
	}
	const { ratingValue, color } = getRatingAndColor(effectiveRating);
	const embed = new EmbedBuilder()
		.setTitle(`📚 ${rec.title}`)
		.setDescription(`**Series by:** ${(rec.authors && Array.isArray(rec.authors)) ? rec.authors.join(', ') : (rec.author || 'Unknown Author')}`)
		.setURL(rec.url)
		.setColor(color)
		.setTimestamp()
		.setFooter({
			text: `From the Profound Bond Library • Recommended by ${rec.recommendedByUsername} • ID: ${rec.id}`
		});
	if (rec.summary) {
		const summaryText = rec.summary.length > 400 ? rec.summary.substring(0, 400) + '...' : rec.summary;
		embed.addFields({
			name: 'Series Summary',
			value: `>>> ${summaryText}`
		});
	}
	const isLinkWorking = rec.deleted ? false : await quickLinkCheck(rec.url);
	const siteInfo = isValidFanficUrl(rec.url);
	const linkText = buildStoryLinkText(rec, isLinkWorking, siteInfo);
	const linkAndMetaFields = [
		{ name: '🔗 Series Link', value: linkText, inline: true }
	];
	if (effectiveRating) linkAndMetaFields.push({ name: 'Rating', value: ratingValue, inline: true });
	addStatusField(linkAndMetaFields, rec);
	embed.addFields(linkAndMetaFields);
	addStatsFields(embed, rec);
	addSeriesWarningsField(embed, { ...rec, series_works: seriesWorks });
	addTagsField(embed, rec);
	addNotesField(embed, rec);
	addEngagementFields(embed, rec);
	if (seriesWorks.length > 0) {
		const maxToShow = 5;
		let worksList = '';
		for (let i = 0; i < Math.min(seriesWorks.length, maxToShow); i++) {
			const work = seriesWorks[i];
			const title = work.title || `Work #${i + 1}`;
			const url = work.url || rec.url;
			worksList += `${i + 1}. [${title}](${url})\n`;
		}
		if (seriesWorks.length > maxToShow) {
			worksList += `${maxToShow}. [and more...](${rec.url})`;
		}
		embed.addFields({
			name: `Works in Series (${seriesWorks.length})`,
			value: worksList.trim()
		});
	}
	return embed;
}