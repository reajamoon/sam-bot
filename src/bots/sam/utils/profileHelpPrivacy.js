
import Discord from 'discord.js';
const { EmbedBuilder } = Discord;
import { createHelpWithBackButton } from './profileHelpButtons.js';
import helpTexts from '../../../shared/text/helpTexts.json' assert { type: 'json' };

/**
 * Create privacy help embed
 * @param {Object} interaction - Discord interaction
 * @returns {Object} Object with embed and component rows
 */

function createPrivacyHelp(interaction) {
    const privacyText = helpTexts.privacy;
    const embed = new EmbedBuilder()
        .setTitle(privacyText.title)
        .setDescription(privacyText.description)
        .addFields(...privacyText.fields)
        .setColor(0x333333);
    return createHelpWithBackButton(embed, interaction);
}

export { createPrivacyHelp };
