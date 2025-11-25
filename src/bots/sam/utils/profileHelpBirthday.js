
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';
import helpTexts from '../../../shared/text/helpTexts.json' assert { type: 'json' };

/**
 * Create birthday help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createBirthdayHelp(interaction) {
    const birthdayText = helpTexts.birthday;
    const embed = new EmbedBuilder()
        .setTitle(birthdayText.title)
        .setDescription(birthdayText.description)
        .addFields(...birthdayText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createBirthdayHelp };
