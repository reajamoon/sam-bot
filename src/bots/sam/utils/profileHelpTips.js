
const { EmbedBuilder } = require('discord.js');
const { createHelpWithBackButton } = require('./profileHelpButtons');
const fs = require('fs');
const path = require('path');
const helpTexts = JSON.parse(fs.readFileSync(path.join(__dirname, 'profileHelp', 'helpTexts.json'), 'utf8'));

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
        .setColor(0x5865F2);
    return createHelpWithBackButton(embed, interaction);
}

module.exports = { createTipsHelp };
