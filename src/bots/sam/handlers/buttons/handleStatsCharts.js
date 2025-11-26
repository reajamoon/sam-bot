
import Discord from 'discord.js';
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { getStatsChartCache } from '../../utils/statsChartCache.js';
import { buildStatsButtonId, parseStatsButtonId } from '../../utils/statsButtonId.new.js';
import handleStats from '../../commands/recHandlers/statsHandler.js';
import { encodeMessageId } from '../../../../shared/utils/messageTracking.js';

// Handles the "View Charts" and "Back to Stats" buttons for stats
export async function handleStatsChartsButton(interaction, options = {}) {
    try {
        console.log('[handleStatsChartsButton] Handler entered for customId:', interaction.customId);
        // Determine if this is a back button or a view charts button
        const isBack = interaction.customId && interaction.customId.startsWith('stats_charts_back:');
    // Always extract the last part as the base64-encoded messageId
    const customId = interaction.customId;
    const parts = customId.split(':');
    // Always use the last part as the base64-encoded messageId
    const encodedMessageId = parts[parts.length - 1];
    let decodedMessageId = null;
    if (encodedMessageId) {
        try {
            decodedMessageId = Buffer.from(encodedMessageId, 'base64').toString('utf8');
        } catch (e) {
            console.error('[handleStatsChartsButton] Failed to decode messageId from base64:', encodedMessageId, e);
        }
    }
    // Always use stats:<decodedMessageId> as the cache key
    console.log('[handleStatsChartsButton] Using decoded messageId for cache and message ops:', decodedMessageId);
    // Track the numeric messageId for use in the back button
    const numericMessageId = decodedMessageId;

    // Helper to update the correct message
    async function updateTargetMessage(payload) {
        if (decodedMessageId && interaction.channel && interaction.channel.messages) {
            try {
                const msg = await interaction.channel.messages.fetch(decodedMessageId);
                if (msg && msg.edit) {
                    await msg.edit(payload);
                    await interaction.deferUpdate();
                    return;
                }
            } catch (e) {
                // fallback to interaction.update
            }
        }
        await interaction.update(payload);
    }

    if (isBack) {
        // Restore the stats embed (re-run handleStats, but edit the correct message)
        const fakeInteraction = {
            ...interaction,
            editReply: updateTargetMessage,
            deferReply: async () => {},
            fetchReply: async () => interaction.message,
            user: interaction.user
        };
        await handleStats(fakeInteraction);
        return;
    }

    // Normal "View Charts" button: replace the message with the chart images and a back button
    // Always use stats:<decodedMessageId> as the cache key
    const cacheKeyToUse = decodedMessageId ? `stats:${decodedMessageId}` : null;
    console.log('[handleStatsChartsButton] About to call getStatsChartCache with key:', cacheKeyToUse);
    const fileMetas = options.files || (cacheKeyToUse ? getStatsChartCache(cacheKeyToUse) : null) || [];
    const files = [];
    for (const f of fileMetas) {
        if (f && f.path && f.name) {
            try {
                const exists = await import('fs').then(fs => fs.existsSync(f.path));
                if (!exists) {
                    console.error('[handleStatsChartsButton] File does not exist:', f.path);
                    continue;
                }
                files.push(new AttachmentBuilder(f.path, { name: f.name }));
            } catch (err) {
                console.error('[handleStatsChartsButton] Error creating AttachmentBuilder for', f.path, err);
            }
        }
    }
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`stats_charts_back:${encodeMessageId(numericMessageId)}`)
            .setLabel('Back to Stats')
            .setStyle(ButtonStyle.Secondary)
    );
    console.log('[handleStatsChartsButton] files array before sending:', files);
    const payload = files.length > 0
        ? { content: 'Here are the charts:', embeds: [], files, components: [backRow], attachments: [] }
        : { content: 'No charts available.', embeds: [], files: [], components: [backRow], attachments: [] };
    console.log('[handleStatsChartsButton] payload before sending:', payload);
        try {
            await updateTargetMessage(payload);
        } catch (err) {
            console.error('[handleStatsChartsButton] Error updating message with payload:', payload, err);
        }
    } catch (err) {
        console.error('[handleStatsChartsButton] Top-level error:', err);
    }
}
