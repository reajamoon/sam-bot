import Discord from 'discord.js';
const { MessageFlags } = Discord;

/**
 * Handler for the stats charts button ("View Charts").
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {Object} options - Optional: pass chart attachments, etc.
 */
export async function handleStatsChartsButton(interaction, options = {}) {
    // You may want to check permissions or context here
    try {
        // Example: Expect chart files in options
        const files = options.files || [];
        if (files.length > 0) {
            await interaction.reply({
                content: 'Here are the charts:',
                files,
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({
                content: 'No charts available.',
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (err) {
        await interaction.reply({
            content: 'There was an error displaying the charts.',
            flags: MessageFlags.Ephemeral
        });
    }
}
