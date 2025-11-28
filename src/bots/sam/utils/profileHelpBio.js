
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
 * Create bio help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

async function createBioHelp(interaction) {
    const helpTexts = await getHelpTexts();
    const bioText = helpTexts.bio;
    const embed = new EmbedBuilder()
        .setTitle(bioText.title)
        .setDescription(bioText.description)
        .addFields(...bioText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createBioHelp };
