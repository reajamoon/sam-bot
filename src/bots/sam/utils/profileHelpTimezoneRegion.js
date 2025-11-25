
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';
import helpTexts from '../../../shared/text/helpTexts.json' assert { type: 'json' };

/**
 * Create timezone/region help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createTimezoneRegionHelp(interaction) {
    const tzText = helpTexts.timezone_region;
    const embed = new EmbedBuilder()
        .setTitle(tzText.title)
        .setDescription(tzText.description)
        .addFields(...tzText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createTimezoneRegionHelp };
