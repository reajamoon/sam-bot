import Discord from 'discord.js';
const { EmbedBuilder, MessageFlags, AttachmentBuilder } = Discord;
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs-extra';
import path from 'path';
import { ratingColors as sharedRatingColors } from '../../../../shared/recUtils/createRecommendationEmbed.js';
import { Recommendation } from '../../../../models/index.js';
import { fn, col, literal } from 'sequelize';

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

    // Fetch all recs for stats
    const allRecs = await Recommendation.findAll({ attributes: ['tags', 'additionalTags', 'recommendedBy', 'author', 'wordCount', 'title', 'rating', 'publishedDate'] });

    // Unique recommenders
    const uniqueRecommenders = new Set(allRecs.map(r => r.recommendedBy)).size;
    // Unique authors
    const uniqueAuthors = new Set(allRecs.map(r => (r.author || '').trim().toLowerCase()).filter(Boolean)).size;
    // Unique works (by title+author combo)
    const uniqueWorks = new Set(allRecs.map(r => `${(r.title || '').trim().toLowerCase()}|${(r.author || '').trim().toLowerCase()}`)).size;
    // Total wordcount
    const totalWordCount = allRecs.reduce((sum, r) => sum + (typeof r.wordCount === 'number' ? r.wordCount : 0), 0);

    // Distribution by publication year
    const yearCounts = {};
    for (const rec of allRecs) {
        if (rec.publishedDate) {
            const year = new Date(rec.publishedDate).getFullYear();
            if (!isNaN(year)) yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    }
    // Sort years ascending
    const sortedYears = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    const yearLines = sortedYears.length
        ? sortedYears.map(y => `${y}: ${yearCounts[y]}`).join(' | ')
        : 'No publication dates found.';

    // --- Chart generation for recs by year ---
    let chartAttachment = null;
    let pieChartPath = null;
    let barChartPath = null;
    let pieChartUrl = null;
    const width = 700;
    const height = 350;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
    // Bar chart for recs by year
    if (sortedYears.length > 0) {
        // Blue to green gradient for bars
        function lerpColor(a, b, t) {
            // a, b: [r,g,b], t: 0..1
            return [
                Math.round(a[0] + (b[0] - a[0]) * t),
                Math.round(a[1] + (b[1] - a[1]) * t),
                Math.round(a[2] + (b[2] - a[2]) * t)
            ];
        }
        const blue = [54, 162, 235];
        const green = [67, 160, 71];
        const n = sortedYears.length;
        const barBgColors = sortedYears.map((_, i) => {
            const t = n === 1 ? 0 : i / (n - 1);
            const [r, g, b] = lerpColor(blue, green, t);
            return `rgba(${r},${g},${b},0.7)`;
        });
        const barBorderColors = sortedYears.map((_, i) => {
            const t = n === 1 ? 0 : i / (n - 1);
            const [r, g, b] = lerpColor(blue, green, t);
            return `rgba(${r},${g},${b},1)`;
        });
        const barConfig = {
            type: 'bar',
            data: {
                labels: sortedYears.map(String),
                datasets: [{
                    label: 'Recs by Year',
                    data: sortedYears.map(y => yearCounts[y]),
                    backgroundColor: barBgColors,
                    borderColor: barBorderColors,
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Recs by Publication Year' }
                },
                scales: {
                    x: { title: { display: true, text: 'Year' } },
                    y: { title: { display: true, text: 'Count' }, beginAtZero: true, precision: 0 }
                }
            }
        };
        const barBuffer = await chartJSNodeCanvas.renderToBuffer(barConfig);
        barChartPath = path.join('/tmp', `rec-stats-year-chart-${Date.now()}.png`);
        await fs.writeFile(barChartPath, barBuffer);
        chartAttachment = new AttachmentBuilder(barChartPath, { name: 'recs-by-year.png' });
    }

    // Pie chart for ratings by percentage
    const ratingLabels = Object.keys(ratingCounts).map(r => r.charAt(0).toUpperCase() + r.slice(1));
    const ratingData = Object.values(ratingCounts);
    // Map normalized rating keys to hex colors from sharedRatingColors, convert to rgba for chartjs
    function hexToRgba(hex, alpha = 0.85) {
        const num = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }
    const ratingKeys = Object.keys(ratingCounts);
    const pieColors = ratingKeys.map(key => {
        const color = sharedRatingColors[key] || 0x757575;
        return hexToRgba(color);
    });
    const pieBorderColors = ratingKeys.map(key => {
        const color = sharedRatingColors[key] || 0x757575;
        return hexToRgba(color, 1);
    });
    if (ratingLabels.length > 0) {
        const pieConfig = {
            type: 'pie',
            data: {
                labels: ratingLabels,
                datasets: [{
                    data: ratingData,
                    backgroundColor: pieColors,
                    borderColor: pieBorderColors,
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { display: true, position: 'bottom' },
                    title: { display: true, text: 'Ratings Distribution' }
                }
            }
        };
        const pieBuffer = await chartJSNodeCanvas.renderToBuffer(pieConfig);
        pieChartPath = path.join('/tmp', `rec-stats-ratings-pie-${Date.now()}.png`);
        await fs.writeFile(pieChartPath, pieBuffer);
        pieChartUrl = 'attachment://ratings-pie.png';
    }

    // Gather all tags (site tags + additionalTags)
    let allTags = [];
    for (const rec of allRecs) {
        if (Array.isArray(rec.tags)) allTags.push(...rec.tags);
        else if (typeof rec.tags === 'string' && rec.tags.trim().startsWith('[')) {
            try { allTags.push(...JSON.parse(rec.tags)); } catch {}
        }
        if (Array.isArray(rec.additionalTags)) allTags.push(...rec.additionalTags);
        else if (typeof rec.additionalTags === 'string' && rec.additionalTags.trim().startsWith('[')) {
            try { allTags.push(...JSON.parse(rec.additionalTags)); } catch {}
        }
    }
    allTags = allTags.map(t => (t || '').trim().toLowerCase()).filter(Boolean);
    const tagCounts = {};
    for (const tag of allTags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count], i) => `#${i + 1}: ${tag} (${count})`)
        .join('\n') || 'No tags found.';

    // Ratings by percentage (emoji only)
    const ratingEmojis = {
        'general audiences': '<:ratinggeneral:1133762158077935749>',
        'teen and up audiences': '<:ratingteen:1133762194174136390>',
        'mature': '<:ratingmature:1133762226738700390>',
        'explicit': '<:ratingexplicit:1133762272087506965>',
        'not rated': '❔',
        'unrated': '❔'
    };
    const ratingCounts = {};
    for (const rec of allRecs) {
        const rating = (rec.rating || '').trim().toLowerCase();
        if (rating) ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
    }
    const ratingPercentages = Object.entries(ratingCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([rating, count]) => {
            const emoji = ratingEmojis[rating] || '';
            if (!emoji) return null;
            const percent = ((100 * count) / totalRecs).toFixed(1);
            return `${emoji} ${percent}%`;
        })
        .filter(Boolean)
        .join('\n') || 'No ratings found.';

    const embed = new EmbedBuilder()
        .setTitle('📊 Profound Bond Library Statistics')
        .setDescription(`Our library currently holds **${totalRecs}** carefully curated fanfiction recommendations`)
        .setColor(0x234567)
        .setTimestamp()
        .addFields(
            { name: 'Unique Recommenders', value: uniqueRecommenders.toString(), inline: true },
            { name: 'Unique Authors', value: uniqueAuthors.toString(), inline: true },
            { name: 'Total Wordcount', value: totalWordCount.toLocaleString(), inline: true },
            { name: 'Ratings', value: ratingPercentages, inline: true },
            { name: 'Top 10 Tags', value: topTags, inline: false },
            { name: 'Recs by Publication Year', value: yearLines, inline: false }
        );
    if (pieChartPath && chartAttachment) {
        // Pie chart as embed image, bar chart as attachment
        embed.setImage('attachment://ratings-pie.png');
        await interaction.editReply({ embeds: [embed], files: [pieChartPath, chartAttachment] });
        // Clean up temp files
        try { await fs.unlink(pieChartPath); } catch {}
        try { await fs.unlink(chartAttachment.attachment); } catch {}
    } else if (pieChartPath) {
        embed.setImage('attachment://ratings-pie.png');
        await interaction.editReply({ embeds: [embed], files: [pieChartPath] });
        try { await fs.unlink(pieChartPath); } catch {}
    } else if (chartAttachment) {
        await interaction.editReply({ embeds: [embed], files: [chartAttachment] });
        try { await fs.unlink(chartAttachment.attachment); } catch {}
    } else {
        await interaction.editReply({ embeds: [embed] });
    }
}

export default handleStats;
