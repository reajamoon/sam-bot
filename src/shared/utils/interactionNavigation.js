// Utility for handling close and back button logic for Discord interactions
// Usage: await handleInteractionNavigation(interaction, { type: 'close', ... })

async function handleInteractionNavigation(interaction, options = {}) {
    const {
        type = 'close', // 'close' or 'back'
        content = type === 'close' ? '✅ Closed.' : '',
        components = [],
        embeds = [],
        flags = 64 // 64 = MessageFlags.Ephemeral
    } = options;

    try {
        await interaction.update({ content, components, embeds });
    } catch (err) {
        // Defensive logging before reply attempt
        if (interaction.replied || interaction.deferred) {
            if (interaction.client && interaction.client.logger) {
                interaction.client.logger.warn('[InteractionNavigation] Interaction already replied or deferred, cannot acknowledge again.');
            } else {
                console.warn('[InteractionNavigation] Interaction already replied or deferred, cannot acknowledge again.');
            }
        }
        // If update fails (e.g., interaction already replied), try to reply
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content, components, embeds, flags });
            }
        } catch (replyErr) {
            // If both update and reply fail, log the error and suppress further exceptions
            if (interaction.client && interaction.client.logger) {
                interaction.client.logger.error('[InteractionNavigation] Failed to acknowledge interaction:', replyErr);
            } else {
                // fallback logging
                console.error('[InteractionNavigation] Failed to acknowledge interaction:', replyErr);
            }
        }
    }
}

module.exports = { handleInteractionNavigation };
