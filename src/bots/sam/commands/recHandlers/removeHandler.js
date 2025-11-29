import Discord from 'discord.js';
const { MessageFlags } = Discord;
import { Recommendation, Series } from '../../../../models/index.js';
import findRecommendationByIdOrUrl from '../../../../shared/recUtils/findRecommendationByIdOrUrl.js';

// Removes a rec from the library. Only owner or mods can do it.
export default async function handleRemoveRecommendation(interaction) {
    // Make sure the interaction didn't time out before starting
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) { // 14 minutes to be safe
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply();
    
    const identifier = interaction.options.getString('identifier');
    try {
        // Find the rec in the database by ID, AO3 WorkId, or URL
        const recommendation = await findRecommendationByIdOrUrl(interaction, identifier);
        if (!recommendation) {
            return await interaction.editReply({
                content: 'Recommendation not found. Please check your identifier and try again.'
            });
        }
        // Only let the owner or a mod remove the rec
        const isOwner = recommendation.recommendedBy === interaction.user.id;
        const isAdmin = interaction.member.permissions.has('ManageMessages');
        if (!isOwner && !isAdmin) {
            return await interaction.editReply({
                content: `That recommendation was added by ${recommendation.recommendedByUsername}. You can only remove your own recommendations unless you're a moderator.`
            });
        }
        // If this is a series rec, remove all associated works and the series record
        if (recommendation.ao3SeriesId) {
            // Remove all recommendations that belong to this series
            const seriesRecs = await Recommendation.findAll({ 
                where: { ao3SeriesId: recommendation.ao3SeriesId } 
            });
            for (const rec of seriesRecs) {
                await rec.destroy();
            }
            
            // Remove the series record itself
            const seriesRecord = await Series.findOne({ 
                where: { ao3SeriesId: recommendation.ao3SeriesId } 
            });
            if (seriesRecord) {
                await seriesRecord.destroy();
            }
        } else {
            // Remove individual recommendation
            await recommendation.destroy();
        }
        await interaction.editReply({
            content: `Successfully removed "${recommendation.title}" by ${recommendation.author} from the Profound Bond library.`
        });
    } catch (error) {
        return await interaction.editReply({
            content: error.message || 'There was an error removing the recommendation. Please try again.'
        });
    }
}
