import Discord from 'discord.js';
const { EmbedBuilder, MessageFlags, AttachmentBuilder } = Discord;
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs-extra';
import path from 'path';
import { Recommendation } from '../../../../models/index.js';
import { fn, col, literal } from 'sequelize';
import normalizeRating from '../../../../shared/recUtils/normalizeRating.js';
import ao3TagColors, { getAo3TagColor, getAo3RatingColor, lerpHexColor } from '../../../../shared/recUtils/ao3/ao3TagColors.js';


// Shows stats for the PB library.
async function handleStats(interaction) {
    // Fetch all recs for stats (must be first)
    const allRecs = await Recommendation.findAll({ attributes: ['tags', 'additionalTags', 'recommendedBy', 'author', 'wordCount', 'title', 'rating', 'publishedDate', 'chapters', 'status'] });

    // ChartJSNodeCanvas must be initialized before any usage
    const width = 700;
    const height = 350;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    // Grouped variable declarations
    let avgWordcountChartPath = null;
    let avgWordcountChartAttachment = null;
    let oneshotVsChapteredChartPath = null;
    let oneshotVsChapteredChartAttachment = null;
    let tagWordcountChartPath = null;
    let tagWordcountChartAttachment = null;
    let pieAttachment = null;
    let pieThumbAttachment = null;
    let pieThumbUrl = null;
    let chartAttachment = null;
    let barChartPath = null;
    let pieChartPath = null;
    let pieChartUrl = null;
    const yearWordcounts = {};
    const yearWorkCounts = {};
    const tagWordcounts = {};
    let oneshotCount = 0, chapteredCount = 0;
    for (const rec of allRecs) {
        if (rec.publishedDate && typeof rec.wordCount === 'number') {
            const year = new Date(rec.publishedDate).getFullYear();
            if (!isNaN(year)) {
                yearWordcounts[year] = (yearWordcounts[year] || 0) + rec.wordCount;
                yearWorkCounts[year] = (yearWorkCounts[year] || 0) + 1;
            }
        }
    }
    const avgYears = Object.keys(yearWordcounts).map(Number).sort((a, b) => a - b);
    if (avgYears.length > 0) {
        const avgWordcounts = avgYears.map(y => yearWordcounts[y] / yearWorkCounts[y]);
        // Use AO3 blue-green gradient for bars
        const ao3Blue = getAo3TagColor(4, 0.7);
        const ao3Green = getAo3TagColor(6, 0.7);
        const ao3BlueBorder = getAo3TagColor(4, 1);
        const ao3GreenBorder = getAo3TagColor(6, 1);
        const n = avgYears.length;
        const barBgColors = avgYears.map((_, i) => {
            const t = n === 1 ? 0 : i / (n - 1);
            return lerpHexColor(ao3Blue, ao3Green, t, 0.7);
        });
        const barBorderColors = avgYears.map((_, i) => {
            const t = n === 1 ? 0 : i / (n - 1);
            return lerpHexColor(ao3BlueBorder, ao3GreenBorder, t, 1);
        });
        const avgBarConfig = {
            type: 'bar',
            data: {
                labels: avgYears.map(String),
                datasets: [{
                    label: 'Avg Wordcount',
                    data: avgWordcounts,
                    backgroundColor: barBgColors,
                    borderColor: barBorderColors,
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Average Wordcount by Year' }
                },
                scales: {
                    x: { title: { display: true, text: 'Year' } },
                    y: { title: { display: true, text: 'Avg Wordcount' }, beginAtZero: true }
                }
            }
        };
        const avgBarBuffer = await chartJSNodeCanvas.renderToBuffer(avgBarConfig);
        avgWordcountChartPath = path.join('/tmp', `rec-stats-avg-wordcount-year-${Date.now()}.png`);
        await fs.writeFile(avgWordcountChartPath, avgBarBuffer);
        avgWordcountChartAttachment = new AttachmentBuilder(avgWordcountChartPath, { name: 'avg-wordcount-by-year.png' });
    }

    // --- Oneshots vs Chaptered chart ---
    for (const rec of allRecs) {
        const chapters = rec.chapters || 1;
        const isComplete = typeof rec.status === 'string' ? rec.status.toLowerCase() === 'complete' : true;
        if (isComplete) {
            if (chapters > 1) chapteredCount++;
            else oneshotCount++;
        }
    }
    const ao3Green = getAo3TagColor(6, 0.7); // green
    const ao3Blue = getAo3TagColor(4, 0.7); // blue
    const ao3GreenBorder = getAo3TagColor(6, 1);
    const ao3BlueBorder = getAo3TagColor(4, 1);
    const oneshotVsChapteredConfig = {
        type: 'pie',
        data: {
            labels: ['Oneshots', 'Chaptered'],
            datasets: [{
                data: [oneshotCount, chapteredCount],
                backgroundColor: [ao3Green, ao3Blue],
                borderColor: [ao3GreenBorder, ao3BlueBorder],
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { display: true, position: 'bottom' },
                title: { display: true, text: 'Oneshots vs. Chaptered' }
            }
        }
    };
    const oneshotVsChapteredBuffer = await chartJSNodeCanvas.renderToBuffer(oneshotVsChapteredConfig);
    oneshotVsChapteredChartPath = path.join('/tmp', `rec-stats-oneshot-vs-chaptered-${Date.now()}.png`);
    await fs.writeFile(oneshotVsChapteredChartPath, oneshotVsChapteredBuffer);
    oneshotVsChapteredChartAttachment = new AttachmentBuilder(oneshotVsChapteredChartPath, { name: 'oneshot-vs-chaptered.png' });

    // --- Top tags by wordcount chart ---
    for (const rec of allRecs) {
        let tags = [];
        if (Array.isArray(rec.tags)) tags.push(...rec.tags);
        else if (typeof rec.tags === 'string' && rec.tags.trim().startsWith('[')) {
            try { tags.push(...JSON.parse(rec.tags)); } catch {}
        }
        if (Array.isArray(rec.additionalTags)) tags.push(...rec.additionalTags);
        else if (typeof rec.additionalTags === 'string' && rec.additionalTags.trim().startsWith('[')) {
            try { tags.push(...JSON.parse(rec.additionalTags)); } catch {}
        }
        tags = tags.map(t => (t || '').trim().toLowerCase()).filter(Boolean);
        for (const tag of tags) {
            tagWordcounts[tag] = (tagWordcounts[tag] || 0) + (typeof rec.wordCount === 'number' ? rec.wordCount : 0);
        }
    }
    const topTagWordcounts = Object.entries(tagWordcounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    if (topTagWordcounts.length > 0) {
        const tagWordcountBarConfig = {
            type: 'bar',
            data: {
                labels: topTagWordcounts.map(([tag]) => tag),
                datasets: [{
                    label: 'Total Wordcount',
                    data: topTagWordcounts.map(([, wc]) => wc),
                    backgroundColor: topTagWordcounts.map((_, i) => getAo3TagColor(i, 0.8)),
                    borderColor: topTagWordcounts.map((_, i) => getAo3TagColor(i, 1)),
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Top Tags by Wordcount' }
                },
                indexAxis: 'y',
                scales: {
                    x: { title: { display: true, text: 'Wordcount' }, beginAtZero: true },
                    y: { title: { display: true, text: 'Tag' } }
                }
            }
        };
        const tagWordcountBarBuffer = await chartJSNodeCanvas.renderToBuffer(tagWordcountBarConfig);
        tagWordcountChartPath = path.join('/tmp', `rec-stats-tag-wordcount-${Date.now()}.png`);
        await fs.writeFile(tagWordcountChartPath, tagWordcountBarBuffer);
        tagWordcountChartAttachment = new AttachmentBuilder(tagWordcountChartPath, { name: 'top-tags-by-wordcount.png' });
    }
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
    // (Removed duplicate declarations of chartAttachment, pieChartPath, barChartPath, pieChartUrl)
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
        const norm = normalizeRating(rec.rating);
        ratingCounts[norm] = (ratingCounts[norm] || 0) + 1;
    }
    // Bar chart for recs by year using AO3 blue and green
    if (sortedYears.length > 0) {
        const ao3Blue = getAo3TagColor(4, 0.7);
        const ao3Green = getAo3TagColor(6, 0.7);
        const ao3BlueBorder = getAo3TagColor(4, 1);
        const ao3GreenBorder = getAo3TagColor(6, 1);
        const n = sortedYears.length;
        const barBgColors = sortedYears.map((_, i) => {
            const t = n === 1 ? 0 : i / (n - 1);
            return lerpHexColor(ao3Blue, ao3Green, t, 0.7);
        });
        const barBorderColors = sortedYears.map((_, i) => {
            const t = n === 1 ? 0 : i / (n - 1);
            return lerpHexColor(ao3BlueBorder, ao3GreenBorder, t, 1);
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
    // Order: explicit > mature > teen and up audiences > general audiences > not rated
    const ratingOrder = [
        'explicit',
        'mature',
        'teen and up audiences',
        'general audiences',
        'not rated'
    ];
    const orderedRatings = ratingOrder.filter(r => ratingCounts[r]).map(r => [r, ratingCounts[r]]);
    // If any unknown ratings exist, append them
    Object.entries(ratingCounts).forEach(([r, c]) => {
        if (!ratingOrder.includes(r)) orderedRatings.push([r, c]);
    });
    const ratingLabels = orderedRatings.map(([r]) => r.charAt(0).toUpperCase() + r.slice(1));
    const ratingData = orderedRatings.map(([, c]) => c);
    const pieColors = orderedRatings.map(([r]) => getAo3RatingColor(r));
    const pieBorderColors = orderedRatings.map(([r]) => getAo3RatingColor(r));
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

    const ratingPercentages = Object.entries(ratingCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([rating, count]) => {
            const emoji = ratingEmojis[rating] || '';
            if (!emoji) return null;
            const percent = ((100 * count) / totalRecs).toFixed(1);
            return `${emoji} ${percent}%`;
        })
        .filter(Boolean)
        .join(', ') || 'No ratings found.';

    const embed = new EmbedBuilder()
        .setTitle('📊 Profound Bond Library Statistics')
        .setDescription(`Our library currently holds **${totalRecs}** carefully curated fanfiction recommendations`)
        .setColor(0x234567)
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
        .addFields(
            { name: 'Total Wordcount', value: totalWordCount.toLocaleString(), inline: true },
            { name: 'Unique Authors', value: uniqueAuthors.toString(), inline: true },
            { name: 'Ratings', value: ratingPercentages, inline: false },
            { name: 'Top 10 Tags', value: topTags, inline: true },
            { name: 'Unique Recommenders', value: uniqueRecommenders.toString(), inline: true }
        );
    // Add pie chart as embed image if available
    if (pieChartPath) {
        // Create a second pie chart without a legend for thumbnail
        // Use a small, square canvas for thumbnail
        const thumbSize = 128;
        const thumbChartJSNodeCanvas = new ChartJSNodeCanvas({ width: thumbSize, height: thumbSize, backgroundColour: 'transparent' });
        const pieThumbConfig = {
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
                layout: { padding: 0 },
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                responsive: false,
                maintainAspectRatio: false
            }
        };
        const pieThumbBuffer = await thumbChartJSNodeCanvas.renderToBuffer(pieThumbConfig);
        const pieThumbPath = path.join('/tmp', `rec-stats-ratings-pie-thumb-${Date.now()}.png`);
        await fs.writeFile(pieThumbPath, pieThumbBuffer);
        pieThumbAttachment = new AttachmentBuilder(pieThumbPath, { name: 'ratings-pie-thumb.png' });
        pieThumbUrl = 'attachment://ratings-pie-thumb.png';
        embed.setThumbnail(pieThumbUrl);
        pieAttachment = new AttachmentBuilder(pieChartPath, { name: 'ratings-pie.png' });
    }

    // Add a button to view charts
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
    const chartsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('view_charts')
            .setLabel('View Charts')
            .setStyle(ButtonStyle.Primary)
    );
    // Only send the thumbnail pie chart as thumbnail, not as image or in follow-up
    const filesToSend = [];
    if (pieThumbAttachment) filesToSend.push(pieThumbAttachment);
    await interaction.editReply({ embeds: [embed], components: [chartsRow], files: filesToSend });

    // Set up a collector for the button
    const filter = i => i.customId === 'view_charts' && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
    collector.on('collect', async i => {
        // Send the charts as a second message (original pie chart, not the thumbnail)
        const files = [];
        if (pieAttachment) files.push(pieAttachment);
        if (chartAttachment) files.push(chartAttachment);
        if (avgWordcountChartAttachment) files.push(avgWordcountChartAttachment);
        if (oneshotVsChapteredChartAttachment) files.push(oneshotVsChapteredChartAttachment);
        if (tagWordcountChartAttachment) files.push(tagWordcountChartAttachment);
        if (files.length > 0) {
            await i.reply({ content: 'Here are the charts:', files, ephemeral: true });
        } else {
            await i.reply({ content: 'No charts available.', ephemeral: true });
        }
        // Clean up temp files
        try { if (pieChartPath) await fs.unlink(pieChartPath); } catch {}
        try { if (chartAttachment) await fs.unlink(chartAttachment.attachment); } catch {}
        try { if (avgWordcountChartPath) await fs.unlink(avgWordcountChartPath); } catch {}
        try { if (oneshotVsChapteredChartPath) await fs.unlink(oneshotVsChapteredChartPath); } catch {}
        try { if (tagWordcountChartPath) await fs.unlink(tagWordcountChartPath); } catch {}
    });
}

export default handleStats;
