
const { EmbedBuilder } = require('discord.js');
const { createHelpWithBackButton } = require('./profileHelpButtons');
const fs = require('fs');
const path = require('path');
const helpTexts = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../shared/text/helpTexts.json'), 'utf8'));

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
        .setColor(0x5865F2);
    return createHelpWithBackButton(embed, interaction);
}

module.exports = { createPrivacyHelp };
