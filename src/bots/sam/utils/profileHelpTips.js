
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';
import helpTexts from '../../../shared/text/helpTexts.json' assert { type: 'json' };

/**
 * Create tips help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createTipsHelp(interaction) {
    const tipsText = helpTexts.tips;
    const embed = new EmbedBuilder()
        .setTitle(tipsText.title)
        .setDescription(tipsText.description)
        .addFields(...tipsText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createTipsHelp };
