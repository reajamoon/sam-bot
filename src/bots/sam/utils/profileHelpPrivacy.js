
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';

let helpTexts;
async function getHelpTexts() {
    if (!helpTexts) {
        helpTexts = (await import('../../../shared/text/helpTexts.json', { with: { type: 'json' } })).default;
    }
    return helpTexts;
}

/**
 * Create privacy help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

async function createPrivacyHelp(interaction) {
    const helpTexts = await getHelpTexts();
    const privacyText = helpTexts.privacy;
    const embed = new EmbedBuilder()
        .setTitle(privacyText.title)
        .setDescription(privacyText.description)
        .addFields(...privacyText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createPrivacyHelp };
