
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';
import helpTexts from '../../../shared/text/helpTexts.json' assert { type: 'json' };

/**
 * Create bio help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createBioHelp(interaction) {
    const bioText = helpTexts.bio;
    const embed = new EmbedBuilder()
        .setTitle(bioText.title)
        .setDescription(bioText.description)
        .addFields(...bioText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createBioHelp };
