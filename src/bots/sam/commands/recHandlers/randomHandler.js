
import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { fetchRecWithSeries } from '../../../../models/fetchRecWithSeries.js';
import { fetchAllRecsWithSeries } from '../../../../models/fetchAllRecsWithSeries.js';
import createRecommendationEmbed, { isSeriesRec } from '../../../../shared/recUtils/createRecommendationEmbed.js';


// Helper: filter recommendations for risky/normal mode
function filterRecommendations(recs, { allowWIP, allowDeleted, allowAbandoned, risky }) {
    let filtered = recs;
    if (!risky) {
        filtered = filtered.filter(rec => {
            if (!rec.notPrimaryWork) return true;
            if (rec.notes && rec.notes.trim()) return true;
            if (Array.isArray(rec.additionalTags) && rec.additionalTags.length > 0) return true;
            return false;
        });
        filtered = filtered.filter(rec => {
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
    return filtered;
}

// Helper: filter by tag with advanced AND/OR logic
function filterByTag(recs, tagFilter) {
    if (!tagFilter) return recs;
    
    // Parse advanced tag syntax: support both 'canon divergence AND bottom dean OR angst'
    // and legacy 'canon divergence+bottom dean, angst'
    let orGroups;
    if (tagFilter.includes(' OR ')) {
        // New syntax: split on OR first
        orGroups = tagFilter.split(' OR ').map(group => group.trim()).filter(Boolean);
    } else {
        // Legacy syntax: split on comma
        orGroups = tagFilter.split(',').map(group => group.trim()).filter(Boolean);
    }
    
    return recs.filter(rec => {
        const allTags = Array.isArray(rec.getParsedTags?.()) ? rec.getParsedTags() : [];
        const tagStrings = allTags.map(tag => tag.toLowerCase());
        
        // Check if rec matches any OR group
        return orGroups.some(group => {
            if (group.includes(' AND ')) {
                // New syntax: AND group
                const andTags = group.split(' AND ').map(t => t.trim().toLowerCase()).filter(Boolean);
                return andTags.every(tag => 
                    tagStrings.some(recTag => recTag.includes(tag))
                );
            } else if (group.includes('+')) {
                // Legacy syntax: + for AND
                const andTags = group.split('+').map(t => t.trim().toLowerCase()).filter(Boolean);
                return andTags.every(tag => 
                    tagStrings.some(recTag => recTag.includes(tag))
                );
            } else {
                // Single tag: just check if it matches any tag
                const tag = group.toLowerCase();
                return tagStrings.some(recTag => recTag.includes(tag));
            }
        });
    });
}

async function handleRandomRecommendation(interaction) {
    try {
        if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
            return await interaction.reply({
                content: 'That interaction took too long to process. Please try the command again.',
                flags: MessageFlags.Ephemeral
            });
        }
        await interaction.deferReply();
        const tagFilter = interaction.options.getString('tag');
        let recommendations = await fetchAllRecsWithSeries(true); // Fetch all recs with series info
        if (!Array.isArray(recommendations)) {
            await interaction.editReply({
                content: 'Sorry, there was a problem fetching recommendations. Please try again later.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Parse override options from command (e.g., allowWIP, allowDeleted, allowAbandoned)
        const allowWIP = !!interaction.options.getBoolean('allowWIP');
        const allowDeleted = !!interaction.options.getBoolean('allowDeleted');
        const allowAbandoned = !!interaction.options.getBoolean('allowAbandoned');
        const risky = !!interaction.options.getBoolean('risky');

        recommendations = filterRecommendations(recommendations, { allowWIP, allowDeleted, allowAbandoned, risky });
        recommendations = filterByTag(recommendations, tagFilter);

        if (recommendations.length === 0) {
            const noResultsMsg = tagFilter
                ? `I couldn't find any fics in our library matching that tag. Try a different search or check \`/rec stats\` to see what we have cataloged.`
                : `The Profound Bond library is empty! Be the first to add a Destiel fic with \`/rec add\`.`;
            return await interaction.editReply({ content: noResultsMsg });
        }
        const rec = recommendations[Math.floor(Math.random() * recommendations.length)];
        // Use fetchRecWithSeries to get full rec+series info
        let recWithSeries;
        try {
            recWithSeries = await fetchRecWithSeries(rec.id, true);
        } catch (err) {
            console.error('Error fetching rec with series:', err);
            return await interaction.editReply({ content: 'Sorry, there was a problem fetching this recommendation.' });
        }
        let embed = null;
        try {
            if (recWithSeries && recWithSeries.series && Array.isArray(recWithSeries.series.works) && recWithSeries.series.works.length > 0) {
                embed = await createRecommendationEmbed(null, recWithSeries.series, recWithSeries.series.works);
            } else {
                embed = await createRecommendationEmbed(recWithSeries);
            }
        } catch (err) {
            console.error('Error creating embed:', err);
        }
        if (!embed) {
            return await interaction.editReply({ content: 'Sorry, there was a problem displaying this recommendation.' });
        }
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('Unexpected error in handleRandomRecommendation:', err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: 'Sorry, something went wrong with your random rec.' });
        } else {
            await interaction.reply({ content: 'Sorry, something went wrong with your random rec.', flags: MessageFlags.Ephemeral });
        }
    }
}

export default handleRandomRecommendation;
