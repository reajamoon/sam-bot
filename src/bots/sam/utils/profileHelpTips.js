
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
 * Create tips help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

async function createTipsHelp(interaction) {
    const helpTexts = await getHelpTexts();
    const tipsText = helpTexts.tips;
    const embed = new EmbedBuilder()
        .setTitle(tipsText.title)
        .setDescription(tipsText.description)
        .addFields(...tipsText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createTipsHelp };
