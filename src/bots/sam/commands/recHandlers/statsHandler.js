const { EmbedBuilder, MessageFlags } = require('discord.js');
const { Recommendation } = require('../../../../models');

// Shows stats for the PB library.
async function handleStats(interaction) {
    if (Date.now() - interaction.createdTimestamp > 14 * 60 * 1000) {
        return await interaction.reply({
            content: 'That interaction took too long to process. Please try the command again.',
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    const totalRecs = await Recommendation.count();
    if (totalRecs === 0) {
        return await interaction.editReply({
            content: 'The Profound Bond library is empty! Help me build our collection by adding some Destiel fics with `/rec add`.'
        });
    }
    const contributorStats = await Recommendation.findAll({
        attributes: [
            'recommendedByUsername',
            [require('sequelize').fn('COUNT', require('sequelize').col('recommendedByUsername')), 'count']
        ],
        group: ['recommendedByUsername'],
        order: [[require('sequelize').literal('count'), 'DESC']],
        limit: 5
    });
    const embed = new EmbedBuilder()
        .setTitle('📊 Profound Bond Library Statistics')
        .setDescription(`Our library currently holds **${totalRecs}** carefully curated fanfiction recommendations`)
        .setColor(0x2196F3)
        .setTimestamp();
    if (contributorStats.length > 0) {
        const contributorList = contributorStats.map((stat, index) =>
            `${index + 1}. ${stat.recommendedByUsername} (${stat.getDataValue('count')} contributions)`
        ).join('\n');
        embed.addFields({ name: 'Top Library Contributors', value: contributorList });
    }
    await interaction.editReply({ embeds: [embed] });
}

module.exports = handleStats;
