
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import createRecommendationEmbed, { isSeriesRec } from '../../../../shared/recUtils/createRecommendationEmbed.js';

// Picks a random fic from the library. Filters by tag if you want.
async function handleRandomRecommendation(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    const tagFilter = interaction.options.getString('tag');
    let recommendations = await fetchRecWithSeries(null, false, true); // We'll filter below

    // Parse override options from command (e.g., allowWIP, allowDeleted, allowAbandoned)
    const allowWIP = interaction.options.getBoolean('allowWIP') || false;
    const allowDeleted = interaction.options.getBoolean('allowDeleted') || false;
    const allowAbandoned = interaction.options.getBoolean('allowAbandoned') || false;
    const risky = interaction.options.getBoolean('risky') || false;

    if (!risky) {
        recommendations = recommendations.filter(rec => {
            if (!rec.notPrimaryWork) return true;
            if (rec.notes && rec.notes.trim()) return true;
            if (Array.isArray(rec.additionalTags) && rec.additionalTags.length > 0) return true;
            return false;
        });
        recommendations = recommendations.filter(rec => {
            if (!allowDeleted && rec.deleted) return false;
            if (!allowWIP && rec.status && typeof rec.status === 'string') {
                const status = rec.status.trim().toLowerCase();
                if (status === 'work in progress' || status === 'wip' || status === 'incomplete') return false;
            }
            if (!allowAbandoned && rec.status && typeof rec.status === 'string') {
                const status = rec.status.trim().toLowerCase();
                if (status.includes('abandon') || status.includes('hiatus')) return false;
            }
            return true;
        });
    }
    if (tagFilter) {
        recommendations = recommendations.filter(rec => {
            const allTags = rec.getParsedTags();
            return allTags.some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()));
        });
    }
    if (recommendations.length === 0) {
        const noResultsMsg = tagFilter
            ? `I couldn't find any fics in our library matching that tag. Try a different search or check \`/rec stats\` to see what we have cataloged.`
            : `The Profound Bond library is empty! Be the first to add a Destiel fic with \`/rec add\`.`;
        return await interaction.editReply({ content: noResultsMsg });
    }
    const rec = recommendations[0];
    // Use fetchRecWithSeries to get full rec+series info
    const recWithSeries = await fetchRecWithSeries(rec.id, true);
    const embed = await createRecommendationEmbed(recWithSeries);
    await interaction.editReply({ embeds: [embed] });
}

export default handleRandomRecommendation;
