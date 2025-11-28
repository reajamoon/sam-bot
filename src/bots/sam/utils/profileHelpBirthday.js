
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
 * Create birthday help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

async function createBirthdayHelp(interaction) {
    const helpTexts = await getHelpTexts();
    const birthdayText = helpTexts.birthday;
    const embed = new EmbedBuilder()
        .setTitle(birthdayText.title)
        .setDescription(birthdayText.description)
        .addFields(...birthdayText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createBirthdayHelp };
